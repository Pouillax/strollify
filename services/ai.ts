import { WalkConfig, PointOfInterest, RouteOption, WalkRoute } from '@/types';
import { getNearbyPlaces, NearbyPlacesResult, getWalkingDirections } from './google-maps';
import { POI_CATEGORIES } from '@/constants/poi-categories';
import { stepsToMeters } from './location';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

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

export async function generateRouteOptions(config: WalkConfig): Promise<RouteOption[]> {
  const targetDistanceMeters = stepsToMeters(config.steps);
  const searchRadius = Math.min(Math.round(targetDistanceMeters / 2), 5000);

  // 1. Récupère les POI
  const allPlaces: NearbyPlacesResult[] = [];
  const placeErrors: string[] = [];
  for (const categoryId of config.selectedCategories) {
    const category = POI_CATEGORIES.find(c => c.id === categoryId);
    if (!category) continue;
    try {
      const places = await getNearbyPlaces(config.startCoordinates, searchRadius, category.googleType, category.keyword, category.excludeTypes);
      allPlaces.push(...places);
      for (const extraType of category.additionalGoogleTypes ?? []) {
        const extra = await getNearbyPlaces(config.startCoordinates, searchRadius, extraType, undefined, category.excludeTypes);
        allPlaces.push(...extra);
      }
    } catch (e: any) {
      placeErrors.push(`${category.label}: ${e.message}`);
    }
  }

  if (allPlaces.length === 0) {
    const detail = placeErrors.length > 0
      ? `\n\nDétails : ${placeErrors.join(' | ')}`
      : "\n\nAucun lieu trouvé dans ce rayon. Essayez une distance plus grande ou d'autres catégories.";
    throw new Error(`Impossible de récupérer les lieux d'intérêt.${detail}`);
  }

  // Filtre les lieux mal notés (< 3.5) en gardant ceux sans note (nouveaux lieux)
  // puis trie par note décroissante pour que l'IA voie les meilleurs en premier
  const MIN_RATING = 3.5;
  const scoredPlaces = allPlaces
    .filter(p => p.rating === undefined || p.rating >= MIN_RATING)
    .sort((a, b) => (b.rating ?? 3.5) - (a.rating ?? 3.5));

  if (scoredPlaces.length === 0) {
    throw new Error('Aucun lieu suffisamment bien noté trouvé dans ce rayon.');
  }

  // 2. Demande 5 propositions à l'IA
  const STEP_TOLERANCE = 2000;
  const minMeters = stepsToMeters(config.steps - STEP_TOLERANCE);
  const maxMeters = stepsToMeters(config.steps + STEP_TOLERANCE);

  const selectedCategoryLabels = config.selectedCategories
    .map(id => POI_CATEGORIES.find(c => c.id === id)?.label)
    .filter(Boolean) as string[];

  const hasEndPoint = config.endCoordinates != null;
  const prompt = `Tu es un assistant de planification de promenades urbaines.

L'utilisateur veut faire une promenade de ${config.steps} pas (≈ ${Math.round(targetDistanceMeters)}m).
CONTRAINTE ABSOLUE DE DISTANCE : le parcours final doit être entre ${Math.round(minMeters)}m et ${Math.round(maxMeters)}m (entre ${config.steps - STEP_TOLERANCE} et ${config.steps + STEP_TOLERANCE} pas). Ne propose pas de lieux trop proches ou trop éloignés qui feraient sortir de cet intervalle.
Point de départ : lat ${config.startCoordinates.latitude}, lng ${config.startCoordinates.longitude}${config.startAddress ? ` (${config.startAddress})` : ''}.
${hasEndPoint ? `Point d'arrivée imposé : lat ${config.endCoordinates!.latitude}, lng ${config.endCoordinates!.longitude}${config.endAddress ? ` (${config.endAddress})` : ''}.` : 'La promenade doit former une boucle (retour au point de départ).'}

Lieux d'intérêt disponibles, triés par note décroissante (${scoredPlaces.length} au total) :
${scoredPlaces.map((p, i) => `${i + 1}. ${p.name} — note: ${p.rating !== undefined ? `${p.rating}/5` : 'non noté'}, types: ${p.types.slice(0, 2).join(', ')}`).join('\n')}

NOTATION : les lieux en tête de liste sont les mieux notés. Préfère-les, sauf contrainte géographique.

Catégories choisies par l'utilisateur : ${selectedCategoryLabels}.

Tu dois générer EXACTEMENT 5 propositions de promenade DISTINCTES.
Chaque route doit avoir une ambiance différente en jouant sur l'équilibre entre les catégories disponibles.
${selectedCategoryLabels.length > 1
  ? `Exemples d'équilibres possibles : une route axée sur un type de lieu, une autre mixte, une autre axée sur un autre type. Invente des combinaisons cohérentes avec les catégories choisies.`
  : `Comme une seule catégorie est sélectionnée, crée 5 routes géographiquement différentes autour de ces lieux.`
}

Règles STRICTES :
1. Chaque route sélectionne 2 à 4 lieux parmi la liste fournie
2. Un même lieu NE PEUT PAS apparaître dans deux routes différentes
3. Les indices sélectionnés doivent être différents entre toutes les routes
4. L'itinéraire doit être logique géographiquement (pas de zigzags inutiles)
5. Choisis des lieux suffisamment espacés pour atteindre la distance cible
6. Donne à chaque route un nom court et évocateur qui reflète son ambiance réelle

Réponds UNIQUEMENT avec ce JSON valide (aucun texte autour) :
{"routes":[{"name":"Nom évocateur court","selectedIndices":[1,3],"reasoning":"1-2 phrases en français"},{"name":"...","selectedIndices":[2,4],"reasoning":"..."},{"name":"...","selectedIndices":[5,6],"reasoning":"..."},{"name":"...","selectedIndices":[7,8],"reasoning":"..."},{"name":"...","selectedIndices":[9,10],"reasoning":"..."}]}`;

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.EXPO_PUBLIC_GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.92,
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

  // 3. Calcule les routes en parallèle via Routes API
  const destination = config.endCoordinates ?? config.startCoordinates;

  const routeResults = await Promise.all(
    parsed.routes.map(async (proposal): Promise<RouteOption | null> => {
      const waypoints = placesToWaypoints(proposal.selectedIndices, scoredPlaces, config);
      if (waypoints.length === 0) return null;
      try {
        const { polylinePoints, totalDistanceMeters, durationSeconds } =
          await getWalkingDirections(
            config.startCoordinates,
            destination,
            waypoints.map(w => w.coordinates)
          );
        const route: WalkRoute = {
          waypoints,
          polylinePoints,
          totalDistanceMeters,
          estimatedSteps: Math.round(totalDistanceMeters / 0.75),
          durationMinutes: Math.round(durationSeconds / 60),
        };
        return { name: proposal.name, reasoning: proposal.reasoning, route };
      } catch {
        return null;
      }
    })
  );

  const allCalculated = routeResults.filter((r): r is RouteOption => r !== null);
  if (allCalculated.length === 0) throw new Error('Aucun itinéraire valide n\'a pu être calculé.');

  // Trie par proximité à la cible : d'abord celles dans la tolérance, puis les autres
  const sorted = allCalculated.sort((a, b) => {
    const aInRange = a.route.totalDistanceMeters >= minMeters && a.route.totalDistanceMeters <= maxMeters;
    const bInRange = b.route.totalDistanceMeters >= minMeters && b.route.totalDistanceMeters <= maxMeters;
    if (aInRange && !bInRange) return -1;
    if (!aInRange && bInRange) return 1;
    return (
      Math.abs(a.route.totalDistanceMeters - targetDistanceMeters) -
      Math.abs(b.route.totalDistanceMeters - targetDistanceMeters)
    );
  });

  return sorted.slice(0, 3);
}
