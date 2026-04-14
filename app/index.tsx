import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';

import AddressInput from '@/components/AddressInput';
import { POI_CATEGORIES } from '@/constants/poi-categories';
import { Colors, Radii, Shadows } from '@/constants/theme';
import { generateRouteOptions } from '@/services/ai';
import {
  geocodeAddress,
  getCurrentLocation,
  requestLocationPermission,
  reverseGeocode,
  stepsToMeters,
} from '@/services/location';
import { Coordinates, WalkConfig } from '@/types';

const STEP_PRESETS = [2000, 5000, 8000, 10000];

export default function HomeScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const sheetRef = useRef<BottomSheet>(null);

  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [startAddress, setStartAddress] = useState('');
  const [startCoords, setStartCoords] = useState<Coordinates | null>(null);
  const [endAddress, setEndAddress] = useState('');
  const [endCoords, setEndCoords] = useState<Coordinates | null>(null);
  const [steps, setSteps] = useState(5000);
  const [customSteps, setCustomSteps] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['park', 'cafe']);
  const [loading, setLoading] = useState(false);

  const snapPoints = useMemo(() => ['22%', '72%'], []);

  useEffect(() => {
    (async () => {
      const granted = await requestLocationPermission();
      if (!granted) {
        Alert.alert('Permission refusée', 'Walkify a besoin de votre position pour fonctionner.');
        return;
      }
      const coords = await getCurrentLocation();
      setUserLocation(coords);
      const address = await reverseGeocode(coords);
      setStartAddress(address);
      mapRef.current?.animateToRegion({
        ...coords,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    })();
  }, []);

  const toggleCategory = useCallback((id: string) => {
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!userLocation && !startAddress) {
      Alert.alert('Position manquante', 'Entrez une adresse de départ ou activez la géolocalisation.');
      return;
    }
    if (selectedCategories.length === 0) {
      Alert.alert('Catégories manquantes', 'Sélectionnez au moins une catégorie de lieux.');
      return;
    }

    setLoading(true);
    try {
      let resolvedStart = startCoords ?? userLocation!;
      if (!resolvedStart && startAddress) {
        const geocoded = await geocodeAddress(startAddress);
        if (geocoded) resolvedStart = geocoded;
      }

      let resolvedEnd: Coordinates | undefined = endCoords ?? undefined;
      if (!resolvedEnd && endAddress.trim()) {
        const geocoded = await geocodeAddress(endAddress);
        if (geocoded) resolvedEnd = geocoded;
      }

      const config: WalkConfig = {
        steps,
        startCoordinates: startCoords,
        startAddress,
        endCoordinates: endCoords,
        endAddress: endAddress || undefined,
        selectedCategories,
      };

      const options = await generateRouteOptions(config);

      router.push({
        pathname: '/route-options',
        params: {
          options: JSON.stringify(options),
          config: JSON.stringify(config),
        },
      });
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }, [userLocation, startAddress, endAddress, steps, selectedCategories, router]);

  const effectiveSteps = customSteps ? parseInt(customSteps) || steps : steps;

  const handleResetLocation = useCallback(async () => {
    if (!userLocation) return;
    const address = await reverseGeocode(userLocation);
    setStartAddress(address);
    setStartCoords(userLocation);
    mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 });
  }, [userLocation]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        showsMyLocationButton={false}
        initialRegion={
          userLocation
            ? { ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }
            : { latitude: 48.8566, longitude: 2.3522, latitudeDelta: 0.1, longitudeDelta: 0.1 }
        }
      />

      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>

          <Text style={styles.title}>Nouvelle promenade</Text>

          {/* Adresses */}
          <Text style={styles.label}>Départ</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputFlex]}
              placeholder="Position actuelle"
              placeholderTextColor={Colors.placeholder}
              value={startAddress}
              onChangeText={setStartAddress}
            />
            <Pressable style={styles.locationBtn} onPress={handleResetLocation}>
              <Text style={styles.locationBtnIcon}>📍</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>
            Arrivée <Text style={styles.optional}>(optionnel)</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Adresse d'arrivée"
            placeholderTextColor={Colors.placeholder}
            value={endAddress}
            onChangeText={setEndAddress}
          />

          {/* Pas */}
          <Text style={styles.label}>Objectif de pas</Text>
          <View style={styles.presetsRow}>
            {STEP_PRESETS.map(preset => {
              const active = steps === preset && !customSteps;
              return (
                <Pressable
                  key={preset}
                  style={[styles.presetBtn, active && styles.presetBtnActive]}
                  onPress={() => { setSteps(preset); setCustomSteps(''); }}
                >
                  <Text style={[styles.presetText, active && styles.presetTextActive]}>
                    {preset >= 1000 ? `${preset / 1000}k` : preset}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Nombre personnalisé..."
            placeholderTextColor={Colors.placeholder}
            keyboardType="numeric"
            value={customSteps}
            onChangeText={setCustomSteps}
          />
          <Text style={styles.distance}>
            ≈ {(stepsToMeters(effectiveSteps) / 1000).toFixed(1)} km
          </Text>

          {/* Catégories */}
          <Text style={styles.label}>Lieux d'intérêt</Text>
          <View style={styles.categoriesGrid}>
            {POI_CATEGORIES.map(cat => {
              const active = selectedCategories.includes(cat.id);
              return (
                <Pressable
                  key={cat.id}
                  style={[styles.categoryBtn, active && styles.categoryBtnActive]}
                  onPress={() => toggleCategory(cat.id)}
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Bouton générer */}
          <Pressable
            style={[styles.generateBtn, loading && styles.generateBtnDisabled]}
            onPress={handleGenerate}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.generateText}>Générer mon parcours</Text>
            }
          </Pressable>

        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  map: { flex: 1 },

  sheetBackground: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
  },
  sheetHandle: { backgroundColor: Colors.border, width: 36 },
  sheetContent: { paddingHorizontal: 22, paddingBottom: 48 },

  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 20,
    marginTop: 6,
    letterSpacing: -0.3,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optional: { fontWeight: '400', textTransform: 'none', letterSpacing: 0 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  inputFlex: { flex: 1 },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  locationBtn: {
    width: 46, height: 46,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationBtnIcon: { fontSize: 20 },
  distance: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
    marginTop: 6,
  },

  presetsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  presetBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  presetBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  presetText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  presetTextActive: { color: '#fff' },

  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: Radii.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  categoryBtnActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  categoryIcon: { fontSize: 15 },
  categoryLabel: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  categoryLabelActive: { color: Colors.primaryDark, fontWeight: '600' },

  generateBtn: {
    marginTop: 28,
    backgroundColor: Colors.primary,
    borderRadius: Radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
    ...Shadows.md,
  },
  generateBtnDisabled: { opacity: 0.55 },
  generateText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
});
