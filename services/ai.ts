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
      const places = await getNearbyPlaces(config.startCoordinates, searchRadius, category.googleType);
      allPlaces.push(...places);
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

  // 2. Demande 3 propositions distinctes à l'IA
  const hasEndPoint = config.endCoordinates != null;
  const prompt = `Tu es un assistant de planification de promenades urbaines.

L'utilisateur veut faire une promenade de ${config.steps} pas (≈ ${Math.round(targetDistanceMeters)}m).
Point de départ : lat ${config.startCoordinates.latitude}, lng ${config.startCoordinates.longitude}${config.startAddress ? ` (${config.startAddress})` : ''}.
${hasEndPoint ? `Point d'arrivée imposé : lat ${config.endCoordinates!.latitude}, lng ${config.endCoordinates!.longitude}${config.endAddress ? ` (${config.endAddress})` : ''}.` : 'La promenade doit former une boucle (retour au point de départ).'}

Lieux d'intérêt disponibles (${allPlaces.length} au total) :
${allPlaces.map((p, i) => `${i + 1}. ${p.name} (note: ${p.rating ?? 'N/A'}, types: ${p.types.slice(0, 2).join(', ')})`).join('\n')}

Génère 3 propositions de promenade DISTINCTES avec des ambiances différentes (ex: nature, culture, détente).
Chaque proposition doit sélectionner 2 à 4 lieux qui forment un itinéraire logique pour la distance cible.
Les 3 propositions doivent utiliser des lieux différents autant que possible.

Réponds UNIQUEMENT avec ce JSON valide (aucun texte autour) :
{"routes":[{"name":"Nom court de la balade","selectedIndices":[1,3],"reasoning":"Explication courte en français"},{"name":"...","selectedIndices":[2,4],"reasoning":"..."},{"name":"...","selectedIndices":[5,6],"reasoning":"..."}]}`;

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

  // 3. Calcule les routes en parallèle via Routes API
  const destination = config.endCoordinates ?? config.startCoordinates;

  const routeResults = await Promise.all(
    parsed.routes.map(async (proposal): Promise<RouteOption | null> => {
      const waypoints = placesToWaypoints(proposal.selectedIndices, allPlaces, config);
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

  const validOptions = routeResults.filter((r): r is RouteOption => r !== null);
  if (validOptions.length === 0) throw new Error('Aucun itinéraire valide n\'a pu être calculé.');
  return validOptions;
}
