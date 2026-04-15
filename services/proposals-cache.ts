import AsyncStorage from '@react-native-async-storage/async-storage';

import { RouteProposal, WalkConfig } from '@/types';

const CACHE_PREFIX = '@strollify/proposals_v1_';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 jours

interface ProposalsCache {
  expiry: number;
  proposals: RouteProposal[];
}

/**
 * Construit une clé de cache depuis la config.
 * - lat/lng arrondis à 2 décimales (≈ 1.1km de granularité)
 * - catégories triées pour éviter les permutations
 * - bucket de distance : arrondi au multiple de 1000m le plus proche (±30%)
 */
function cacheKey(config: WalkConfig): string {
  const lat = config.startCoordinates.latitude.toFixed(2);
  const lng = config.startCoordinates.longitude.toFixed(2);

  const cats = [...config.selectedCategories].sort().join(',');

  // Calcule la distance cible en mètres depuis les pas
  // stepsToMeters n'est pas importé ici pour éviter une dépendance circulaire,
  // on utilise directement config.steps × 0.75 (valeur par défaut)
  const rawMeters = config.steps * 0.75;
  // Bucket : arrondi au multiple de 1000 le plus proche
  const bucket = Math.round(rawMeters / 1000) * 1000;

  return `${CACHE_PREFIX}${lat}_${lng}_${cats}_${bucket}`;
}

export async function getCachedProposals(config: WalkConfig): Promise<RouteProposal[] | null> {
  try {
    const key = cacheKey(config);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const cached: ProposalsCache = JSON.parse(raw);
    if (Date.now() > cached.expiry) {
      AsyncStorage.removeItem(key);
      return null;
    }
    return cached.proposals;
  } catch {
    return null;
  }
}

export async function setCachedProposals(
  config: WalkConfig,
  proposals: RouteProposal[]
): Promise<void> {
  try {
    const key = cacheKey(config);
    const payload: ProposalsCache = {
      expiry: Date.now() + CACHE_TTL,
      proposals,
    };
    await AsyncStorage.setItem(key, JSON.stringify(payload));
  } catch {}
}
