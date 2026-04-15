import { WalkConfig, PointOfInterest, RouteOption, RouteProposal, WalkRoute } from '@/types';
import { getNearbyPlaces, NearbyPlacesResult, getWalkingDirections } from './google-maps';
import { getCachedProposals, setCachedProposals } from './proposals-cache';
import { POI_CATEGORIES } from '@/constants/poi-categories';
import { stepsToMeters } from './location';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

const WALK_SPEED_MPS = 1.35; // m/s, marche normale
const URBAN_DETOUR_FACTOR = 1.35; // les rues ne sont pas à vol d'oiseau

/** Distance haversine en mètres entre deux coordonnées */
function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * Estime la distance et la durée d'une proposition sans appel API.
 * Chaîne start → wp1 → wp2 → ... → end, corrigée par le facteur urbain.
 */
export function estimateProposal(
  proposal: RouteProposal,
  config: WalkConfig
): { distanceMeters: number; durationMinutes: number } {
  const points = [
    config.startCoordinates,
    ...proposal.waypoints.map(w => w.coordinates),
    config.endCoordinates ?? config.startCoordinates,
  ];
  let rawDistance = 0;
  for (let i = 0; i < points.length - 1; i++) {
    rawDistance += haversineMeters(points[i], points[i + 1]);
  }
  const distanceMeters = Math.round(rawDistance * URBAN_DETOUR_FACTOR);
  const durationMinutes = Math.round(distanceMeters / WALK_SPEED_MPS / 60);
  return { distanceMeters, durationMinutes };
}

interface AIProposal {
  name: string;
  selectedIndices: number[];
  reasoning: string;
}

function placesToWaypoints(
  indices: number[],
  allPlaces: NearbyPlacesResult[],
  config: WalkConfig
): PointOfInterest[] {
  return indices
    .filter((i: number) => i >= 1 && i <= allPlaces.length)
    .map((i: number) => {
      const place = allPlaces[i - 1];
      const categoryId =
        config.selectedCategories.find(catId => {
          const cat = POI_CATEGORIES.find(c => c.id === catId);
          return cat && place.types.includes(cat.googleType);
        }) ?? config.selectedCategories[0];
      return {
        id: place.placeId,
        name: place.name,
        coordinates: place.coordinates,
        category: categoryId,
        address: place.address,
        rating: place.rating,
      };
    });
}

/**
 * Calcule la vraie route pour une proposition (1 appel Routes API).
 * À appeler uniquement quand l'utilisateur confirme son choix.
 */
export async function resolveRoute(
  proposal: RouteProposal,
  config: WalkConfig
): Promise<RouteOption> {
  const destination = config.endCoordinates ?? config.startCoordinates;
  const { polylinePoints, totalDistanceMeters, durationSeconds } =
    await getWalkingDirections(
      config.startCoordinates,
      destination,
      proposal.waypoints.map(w => w.coordinates)
    );
  const route: WalkRoute = {
    waypoints: proposal.waypoints,
    polylinePoints,
    totalDistanceMeters,
    estimatedSteps: Math.round(totalDistanceMeters * (1 / 0.75)),
    durationMinutes: Math.round(durationSeconds / 60),
  };
  return { name: proposal.name, reasoning: proposal.reasoning, route };
}

/**
 * Génère 3 propositions de promenade (POI sélectionnés par l'IA).
 * N'appelle PAS la Routes API — pas de polyline à ce stade.
 */
export async function generateRouteProposals(config: WalkConfig): Promise<RouteProposal[]> {
  // Vérifie d'abord le cache local (TTL 7 jours, granularité ≈1km + catégories + distance ±30%)
  const cached = await getCachedProposals(config);
  if (cached) return cached;

  const targetDistanceMeters = stepsToMeters(config.steps);
  const searchRadius = Math.min(Math.round(targetDistanceMeters / 2), 5000);

  // 1. Récupère les POI de toutes les catégories en parallèle
  const categories = config.selectedCategories
    .map(id => POI_CATEGORIES.find(c => c.id === id))
    .filter(Boolean) as typeof POI_CATEGORIES;

  const placeResults = await Promise.allSettled(
    categories.map(cat => getNearbyPlaces(config.startCoordinates, searchRadius, cat.googleType))
  );

  // Dédupliquer par placeId (un lieu peut apparaître dans plusieurs catégories)
  const seenIds = new Set<string>();
  const allPlaces: NearbyPlacesResult[] = [];
  const placeErrors: string[] = [];

  placeResults.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      for (const place of result.value) {
        if (!seenIds.has(place.placeId)) {
          seenIds.add(place.placeId);
          allPlaces.push(place);
        }
      }
    } else {
      placeErrors.push(`${categories[i].label}: ${result.reason?.message ?? 'erreur'}`);
    }
  });

  if (allPlaces.length === 0) {
    const detail = placeErrors.length > 0
      ? `\n\nDétails : ${placeErrors.join(' | ')}`
      : "\n\nAucun lieu trouvé dans ce rayon. Essayez une distance plus grande ou d'autres catégories.";
    throw new Error(`Impossible de récupérer les lieux d'intérêt.${detail}`);
  }

  // 2. Demande 3 propositions distinctes à l'IA
  const hasEndPoint = config.endCoordinates != null;
  const goalDescription = config.durationMinutesTarget != null
    ? `une promenade de ${config.durationMinutesTarget} minutes (≈ ${Math.round(targetDistanceMeters)}m)`
    : `une promenade de ${config.steps} pas (≈ ${Math.round(targetDistanceMeters)}m)`;

  // On passe les coordonnées pour que l'IA puisse raisonner géographiquement
  const start = config.startCoordinates;
  const prompt = `Tu es un assistant de planification de promenades urbaines. Tu dois produire des itinéraires géographiquement cohérents.

OBJECTIF : ${goalDescription}.
DÉPART : lat ${start.latitude.toFixed(5)}, lng ${start.longitude.toFixed(5)}${config.startAddress ? ` (${config.startAddress})` : ''}.
${hasEndPoint
  ? `ARRIVÉE : lat ${config.endCoordinates!.latitude.toFixed(5)}, lng ${config.endCoordinates!.longitude.toFixed(5)}${config.endAddress ? ` (${config.endAddress})` : ''}.`
  : 'TYPE : boucle (retour au point de départ).'}

LIEUX DISPONIBLES :
${allPlaces.map((p, i) =>
  `${i + 1}. ${p.name} — lat ${p.coordinates.latitude.toFixed(5)}, lng ${p.coordinates.longitude.toFixed(5)} (note: ${p.rating ?? 'N/A'})`
).join('\n')}

RÈGLES IMPÉRATIVES :
- Choisis 2 à 4 lieux qui forment un itinéraire progressif dans UNE MÊME DIRECTION depuis le départ, sans revenir en arrière sur ses pas.
- L'ordre des indices dans selectedIndices doit refléter l'ordre géographique logique du trajet (pas de zigzag).
- Les lieux choisis doivent être espacés régulièrement sur le trajet, pas tous regroupés au même endroit.
- Chaque proposition doit avoir une ambiance différente (ex : nature, culture, quartier animé).
- Les 3 propositions doivent utiliser des lieux différents autant que possible.

Réponds UNIQUEMENT avec ce JSON valide (aucun texte autour) :
{"routes":[{"name":"Nom court","selectedIndices":[1,3],"reasoning":"Explication courte en français pourquoi cet itinéraire est cohérent"},{"name":"...","selectedIndices":[2,4],"reasoning":"..."},{"name":"...","selectedIndices":[5,6],"reasoning":"..."}]}`;

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.EXPO_PUBLIC_GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Groq error ${response.status}`);
  }

  const data = await response.json();
  const text: string = data.choices?.[0]?.message?.content ?? '';

  let parsed: { routes: AIProposal[] };
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    if (!Array.isArray(parsed.routes) || parsed.routes.length === 0) throw new Error();
  } catch {
    throw new Error('Réponse IA invalide');
  }

  // 3. Construire les propositions (waypoints uniquement, pas de Routes API)
  const proposals: RouteProposal[] = parsed.routes
    .map((proposal): RouteProposal | null => {
      const waypoints = placesToWaypoints(proposal.selectedIndices, allPlaces, config);
      if (waypoints.length === 0) return null;
      return { name: proposal.name, reasoning: proposal.reasoning, waypoints };
    })
    .filter((p): p is RouteProposal => p !== null);

  if (proposals.length === 0) throw new Error('Aucune proposition valide générée.');

  // Sauvegarde en cache pour les prochaines requêtes similaires
  await setCachedProposals(config, proposals).catch(() => {});

  return proposals;
}
