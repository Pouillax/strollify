import { PoiCategory } from '@/types';

export const POI_CATEGORIES: PoiCategory[] = [
  { id: 'park',       label: 'Parcs',        googleType: 'park',            icon: '🌳' },
  { id: 'cafe',       label: 'Cafés',        googleType: 'cafe',            icon: '☕' },
  { id: 'museum',     label: 'Musées',       googleType: 'museum',          icon: '🏛️' },
  { id: 'restaurant', label: 'Restaurants',  googleType: 'restaurant',      icon: '🍽️' },
  { id: 'monument',   label: 'Monuments',    googleType: 'tourist_attraction', icon: '🗿' },
  { id: 'library',    label: 'Bibliothèques',googleType: 'library',         icon: '📚' },
  { id: 'market',     label: 'Marchés',      googleType: 'supermarket',     icon: '🛒' },
  { id: 'garden',     label: 'Jardins',      googleType: 'botanical_garden',icon: '🌸' },
];
