import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { POI_CATEGORIES } from '@/constants/poi-categories';
import { Colors, Radii, Shadows } from '@/constants/theme';
import { RouteOption, WalkConfig } from '@/types';

function getBoundingRegion(option: RouteOption) {
  const coords = option.route.polylinePoints;
  if (coords.length === 0) return null;
  const lats = coords.map(c => c.latitude);
  const lngs = coords.map(c => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const padding = 0.004;
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: maxLat - minLat + padding,
    longitudeDelta: maxLng - minLng + padding,
  };
}

function RouteCard({
  option,
  index,
  selected,
  onPress,
}: {
  option: RouteOption;
  index: number;
  selected: boolean;
  onPress: () => void;
}) {
  const region = getBoundingRegion(option);

  return (
    <Pressable
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
    >
      {/* Mini carte */}
      <View style={styles.miniMapContainer}>
        <MapView
          style={styles.miniMap}
          provider={PROVIDER_GOOGLE}
          initialRegion={region ?? undefined}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          pointerEvents="none"
        >
          <Polyline
            coordinates={option.route.polylinePoints}
            strokeColor={selected ? Colors.primary : Colors.primaryBorder}
            strokeWidth={3}
          />
        </MapView>
        <View style={[styles.indexBadge, selected && styles.indexBadgeSelected]}>
          <Text style={[styles.indexBadgeText, selected && styles.indexBadgeTextSelected]}>
            {index + 1}
          </Text>
        </View>
        {selected && (
          <View style={styles.selectedCheck}>
            <Text style={styles.selectedCheckText}>✓</Text>
          </View>
        )}
      </View>

      {/* Infos */}
      <View style={styles.cardContent}>
        <Text style={[styles.cardName, selected && styles.cardNameSelected]} numberOfLines={1}>
          {option.name}
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statText}>🚶 {option.route.estimatedSteps.toLocaleString()} pas</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statText}>📍 {(option.route.totalDistanceMeters / 1000).toFixed(1)} km</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statText}>⏱ {option.route.durationMinutes} min</Text>
          </View>
        </View>

        <Text style={styles.reasoning} numberOfLines={selected ? undefined : 2}>
          {option.reasoning}
        </Text>

        {/* POI chips */}
        <View style={styles.poiRow}>
          {option.route.waypoints.slice(0, 4).map(poi => {
            const cat = POI_CATEGORIES.find(c => c.id === poi.category);
            return (
              <View key={poi.id} style={[styles.poiChip, selected && styles.poiChipSelected]}>
                <Text style={styles.poiIcon}>{cat?.icon ?? '📍'}</Text>
                <Text style={[styles.poiName, selected && styles.poiNameSelected]} numberOfLines={1}>
                  {poi.name}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </Pressable>
  );
}

export default function RouteOptionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ options: string; config: string }>();
  const options: RouteOption[] = JSON.parse(params.options);
  const config: WalkConfig = JSON.parse(params.config);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleStart = () => {
    const chosen = options[selectedIndex];
    router.push({
      pathname: '/route-preview',
      params: {
        route: JSON.stringify(chosen.route),
        config: params.config,
        reasoning: chosen.reasoning,
      },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Retour</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Choisissez votre promenade</Text>
        <Text style={styles.headerSub}>
          {options.length} parcours générés · {config.steps.toLocaleString()} pas
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {options.map((option, index) => (
          <RouteCard
            key={index}
            option={option}
            index={index}
            selected={selectedIndex === index}
            onPress={() => setSelectedIndex(index)}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.startBtn} onPress={handleStart}>
          <Text style={styles.startBtnText}>Voir ce parcours en détail</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    backgroundColor: Colors.card,
    paddingTop: 60,
    paddingBottom: 18,
    paddingHorizontal: 22,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  backBtn: { marginBottom: 12 },
  backBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  headerSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },

  scrollContent: { padding: 16, gap: 16, paddingBottom: 120 },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radii.xl,
    borderWidth: 2,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  cardSelected: {
    borderColor: Colors.primary,
    ...Shadows.md,
  },

  miniMapContainer: { height: 150, position: 'relative' },
  miniMap: { ...StyleSheet.absoluteFillObject },

  indexBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  indexBadgeSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  indexBadgeText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  indexBadgeTextSelected: { color: '#fff' },

  selectedCheck: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: Colors.primary,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  selectedCheckText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  cardContent: { padding: 16 },
  cardName: {
    fontSize: 17, fontWeight: '700',
    color: Colors.text, marginBottom: 10,
    letterSpacing: -0.2,
  },
  cardNameSelected: { color: Colors.primaryDark },

  statsRow: { flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  statPill: {
    backgroundColor: Colors.background,
    borderRadius: Radii.full,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },

  reasoning: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },

  poiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  poiChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.background,
    borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 4, paddingHorizontal: 10,
  },
  poiChipSelected: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primaryBorder,
  },
  poiIcon: { fontSize: 12 },
  poiName: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500', maxWidth: 90 },
  poiNameSelected: { color: Colors.primaryDark },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.card,
    padding: 16, paddingBottom: 36,
    borderTopWidth: 1, borderTopColor: Colors.divider,
  },
  startBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
    ...Shadows.md,
  },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
});
