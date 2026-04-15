import { Coordinates } from '@/types';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY!;

// Décode une polyline encodée Google en tableau de coordonnées
export function decodePolyline(encoded: string): Coordinates[] {
  const points: Coordinates[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

export interface DirectionsResult {
  polylinePoints: Coordinates[];
  totalDistanceMeters: number;
  durationSeconds: number;
}

export async function getWalkingDirections(
  origin: Coordinates,
  destination: Coordinates,
  waypoints: Coordinates[] = []
): Promise<DirectionsResult> {
  const body: any = {
    origin: {
      location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } },
    },
    destination: {
      location: { latLng: { latitude: destination.latitude, longitude: destination.longitude } },
    },
    travelMode: 'WALK',
    polylineEncoding: 'ENCODED_POLYLINE',
    computeAlternativeRoutes: false,
  };

  if (waypoints.length > 0) {
    body.intermediates = waypoints.map(w => ({
      location: { latLng: { latitude: w.latitude, longitude: w.longitude } },
    }));
    body.optimizeWaypointOrder = true;
  }

  const response = await fetch(
    'https://routes.googleapis.com/directions/v2:computeRoutes',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.optimizedIntermediateWaypointIndex',
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();

  if (!data.routes || data.routes.length === 0) {
    throw new Error(`Routes API error: ${data.error?.message ?? 'Aucun itinéraire trouvé'}`);
  }

  const route = data.routes[0];
  const polylinePoints = decodePolyline(route.polyline.encodedPolyline);
  const totalDistanceMeters = route.distanceMeters;
  const durationSeconds = parseInt(route.duration?.replace('s', '') ?? '0', 10);

  return { polylinePoints, totalDistanceMeters, durationSeconds };
}

export interface NearbyPlacesResult {
  placeId: string;
  name: string;
  coordinates: Coordinates;
  address: string;
  rating?: number;
  types: string[];
}

export async function getNearbyPlaces(
  location: Coordinates,
  radiusMeters: number,
  type: string | undefined,
  keyword?: string,
  excludeTypes?: string[]
): Promise<NearbyPlacesResult[]> {
  let url =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${location.latitude},${location.longitude}` +
    `&radius=${radiusMeters}&key=${API_KEY}`;
  if (type) url += `&type=${type}`;
  if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Places API error: ${data.status}`);
  }

  return (data.results || [])
    .filter((place: any) => {
      if (!excludeTypes || excludeTypes.length === 0) return true;
      return !place.types?.some((t: string) => excludeTypes.includes(t));
    })
    .slice(0, 10)
    .map((place: any) => ({
      placeId: place.place_id,
      name: place.name,
      coordinates: {
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
      },
      address: place.vicinity || '',
      rating: place.rating,
      types: place.types || [],
    }));
}

export interface AutocompleteSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export async function getAddressSuggestions(
  input: string
): Promise<AutocompleteSuggestion[]> {
  if (input.trim().length < 2) return [];

  const url =
    `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
    `?input=${encodeURIComponent(input)}&language=fr&types=geocode&key=${API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return [];

  return (data.predictions || []).slice(0, 5).map((p: any) => ({
    placeId: p.place_id,
    description: p.description,
    mainText: p.structured_formatting?.main_text ?? p.description,
    secondaryText: p.structured_formatting?.secondary_text ?? '',
  }));
}

export async function getPlaceCoordinates(placeId: string): Promise<Coordinates | null> {
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${placeId}&fields=geometry&key=${API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== 'OK') return null;
  const loc = data.result?.geometry?.location;
  if (!loc) return null;
  return { latitude: loc.lat, longitude: loc.lng };
}
