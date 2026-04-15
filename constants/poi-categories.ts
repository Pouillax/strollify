import { PoiCategory } from '@/types';

export const POI_CATEGORIES: PoiCategory[] = [
  {
    id: 'park', label: 'Parcs', googleType: 'park', icon: '🌳',
    excludeTypes: ['lodging', 'hotel', 'campground', 'rv_park'],
  },
  {
    id: 'cafe', label: 'Cafés & Bars', googleType: 'cafe', icon: '☕',
    additionalGoogleTypes: ['bar'],
    excludeTypes: ['supermarket', 'grocery_or_supermarket', 'convenience_store', 'department_store', 'food'],
  },
  { id: 'museum',     label: 'Musées',       googleType: 'museum',             icon: '🏛️' },
  {
    id: 'restaurant', label: 'Restaurants', googleType: 'restaurant', icon: '🍽️',
    excludeTypes: ['supermarket', 'grocery_or_supermarket', 'convenience_store'],
  },
  {
    id: 'monument', label: 'Monuments', googleType: 'tourist_attraction', icon: '🗿',
    keyword: 'monument OR statue OR landmark OR historic',
    excludeTypes: ['amusement_center', 'amusement_park', 'bowling_alley', 'casino', 'night_club', 'bar', 'lodging'],
  },
  { id: 'library',    label: 'Bibliothèques',googleType: 'library',            icon: '📚' },
  { id: 'market', label: 'Marchés', icon: '🛒', keyword: 'marché' },
  { id: 'garden',     label: 'Jardins',      googleType: 'botanical_garden',   icon: '🌸' },
];
