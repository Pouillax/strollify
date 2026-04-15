export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface PoiCategory {
  id: string;
  label: string;
  googleType: string;
  icon: string;
}

export interface PointOfInterest {
  id: string;
  name: string;
  coordinates: Coordinates;
  category: string;
  address?: string;
  rating?: number;
}

export interface WalkConfig {
  steps: number;
  durationMinutesTarget?: number;
  startCoordinates: Coordinates;
  startAddress?: string;
  endCoordinates?: Coordinates;
  endAddress?: string;
  selectedCategories: string[];
}

export interface WalkRoute {
  waypoints: PointOfInterest[];
  polylinePoints: Coordinates[];
  totalDistanceMeters: number;
  estimatedSteps: number;
  durationMinutes: number;
}

// Proposition IA avant calcul de route (0 appel Routes API)
export interface RouteProposal {
  name: string;
  reasoning: string;
  waypoints: PointOfInterest[];
}

// Proposition avec route calculée (après confirmation utilisateur)
export interface RouteOption {
  name: string;
  reasoning: string;
  route: WalkRoute;
}

export interface WalkRecord {
  id: string;
  savedAt: string;
  routeName: string;
  stepsWalked: number;
  distanceMeters: number;
  durationSeconds: number;
  poisVisited: number;
  totalPois: number;
  config: WalkConfig;
  route: WalkRoute;
  isFavorite?: boolean;
}
