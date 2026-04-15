export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface PoiCategory {
  id: string;
  label: string;
  googleType?: string;
  icon: string;
  keyword?: string;
  additionalGoogleTypes?: string[];
  excludeTypes?: string[];
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

export interface RouteOption {
  name: string;
  reasoning: string;
  route: WalkRoute;
}
