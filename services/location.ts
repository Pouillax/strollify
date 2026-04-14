import * as Location from 'expo-location';
import { Coordinates } from '@/types';

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentLocation(): Promise<Coordinates> {
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const results = await Location.geocodeAsync(address);
  if (results.length === 0) return null;
  return {
    latitude: results[0].latitude,
    longitude: results[0].longitude,
  };
}

export async function reverseGeocode(coords: Coordinates): Promise<string> {
  const results = await Location.reverseGeocodeAsync(coords);
  if (results.length === 0) return '';
  const r = results[0];
  return [r.street, r.city].filter(Boolean).join(', ');
}

/** Convertit des mètres en pas (1 pas ≈ 0.75 m) */
export function metersToSteps(meters: number): number {
  return Math.round(meters / 0.75);
}

/** Convertit des pas en mètres */
export function stepsToMeters(steps: number): number {
  return steps * 0.75;
}
