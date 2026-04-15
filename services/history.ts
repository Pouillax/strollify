import AsyncStorage from '@react-native-async-storage/async-storage';

import { WalkRecord } from '@/types';

const STORAGE_KEY = '@strollify/walk_history';

// Planchers physiologiques
const MIN_STEPS_PER_METER = 1.0;   // ~1m/pas (marche très lente)
const MAX_STEPS_PER_METER = 2.0;   // ~50cm/pas (course)
const DEFAULT_STEPS_PER_METER = 1 / 0.75; // ~1.333 pas/m, 0.75m/pas

/**
 * Calcule la cadence personnalisée (pas/mètre) à partir des marches validées.
 * Une marche est validée si : distanceMeters >= 100 ET distanceMeters >= 10% de route.totalDistanceMeters.
 * Retourne DEFAULT_STEPS_PER_METER si pas assez de données.
 */
export function computePersonalCadence(walks: WalkRecord[]): number {
  const valid = walks.filter(w => {
    const minDist = Math.max(100, w.route.totalDistanceMeters * 0.1);
    return w.distanceMeters >= minDist && w.stepsWalked > 0;
  });

  if (valid.length === 0) return DEFAULT_STEPS_PER_METER;

  // Moyenne pondérée par la distance (les longues marches ont plus de poids)
  const totalDist = valid.reduce((s, w) => s + w.distanceMeters, 0);
  const weightedCadence = valid.reduce(
    (s, w) => s + (w.stepsWalked / w.distanceMeters) * (w.distanceMeters / totalDist),
    0
  );

  // Clamp entre les planchers physiologiques
  return Math.min(MAX_STEPS_PER_METER, Math.max(MIN_STEPS_PER_METER, weightedCadence));
}

export async function saveWalk(record: WalkRecord): Promise<void> {
  const existing = await getWalks();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...existing]));
}

export async function getWalks(): Promise<WalkRecord[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as WalkRecord[];
  } catch {
    return [];
  }
}

export async function deleteWalk(id: string): Promise<void> {
  const existing = await getWalks();
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(existing.filter(w => w.id !== id))
  );
}

export async function toggleFavorite(id: string): Promise<void> {
  const existing = await getWalks();
  const updated = existing.map(w =>
    w.id === id ? { ...w, isFavorite: !w.isFavorite } : w
  );
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}
