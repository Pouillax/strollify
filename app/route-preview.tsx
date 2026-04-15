import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { POI_CATEGORIES } from '@/constants/poi-categories';
import { Colors, Radii, Shadows } from '@/constants/theme';
import { WalkConfig, WalkRoute } from '@/types';

function getBoundingRegion(route: WalkRoute) {
  const coords = route.polylinePoints;
  if (coords.length === 0) return null;
  const lats = coords.map(c => c.latitude);
  const lngs = coords.map(c => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const padding = 0.005;
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: maxLat - minLat + padding,
    longitudeDelta: maxLng - minLng + padding,
  };
}

export default function RoutePreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ route: string; config: string; reasoning: string; routeName?: string }>();
  const mapRef = useRef<MapView>(null);

  const route: WalkRoute = JSON.parse(params.route);
  const config: WalkConfig = JSON.parse(params.config);
  const reasoning = params.reasoning ?? '';
  const region = getBoundingRegion(route);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region ?? undefined}
      >
        <Polyline
          coordinates={route.polylinePoints}
          strokeColor={Colors.primary}
          strokeWidth={4}
        />

        <Marker coordinate={config.startCoordinates} title="Départ" pinColor={Colors.success} />

        {config.endCoordinates && (
          <Marker coordinate={config.endCoordinates} title="Arrivée" pinColor={Colors.error} />
        )}

        {route.waypoints.map((poi, index) => {
          const category = POI_CATEGORIES.find(c => c.id === poi.category);
          return (
            <Marker
              key={poi.id}
              coordinate={poi.coordinates}
              title={poi.name}
              description={poi.address}
            >
              <View style={styles.poiMarker}>
                <Text style={styles.poiMarkerIcon}>{category?.icon ?? '📍'}</Text>
                <View style={styles.poiMarkerBadge}>
                  <Text style={styles.poiMarkerNumber}>{index + 1}</Text>
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Bouton retour */}
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>← Retour</Text>
      </Pressable>

      {/* Carte récapitulatif */}
      <View style={styles.card}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{route.estimatedSteps.toLocaleString()}</Text>
            <Text style={styles.statLabel}>pas estimés</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{(route.totalDistanceMeters / 1000).toFixed(1)} km</Text>
            <Text style={styles.statLabel}>distance</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{route.durationMinutes} min</Text>
            <Text style={styles.statLabel}>durée estimée</Text>
          </View>
        </View>

        {/* Explication IA */}
        {reasoning ? (
          <View style={styles.reasoningBox}>
            <Text style={styles.reasoningText}>🌿 {reasoning}</Text>
          </View>
        ) : null}

        {/* Liste des POI */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.poiList}
          contentContainerStyle={styles.poiListContent}
        >
          {route.waypoints.map((poi, index) => {
            const category = POI_CATEGORIES.find(c => c.id === poi.category);
            return (
              <View key={poi.id} style={styles.poiChip}>
                <View style={styles.poiChipNumber}>
                  <Text style={styles.poiChipNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.poiChipIcon}>{category?.icon ?? '📍'}</Text>
                <Text style={styles.poiChipName} numberOfLines={1}>{poi.name}</Text>
              </View>
            );
          })}
        </ScrollView>

        <Pressable
          style={styles.startBtn}
          onPress={() =>
            router.push({
              pathname: '/walk',
              params: { route: params.route, config: params.config, routeName: params.routeName ?? '' },
            })
          }
        >
          <Text style={styles.startBtnText}>Commencer la promenade</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  backBtn: {
    position: 'absolute', top: 56, left: 16,
    backgroundColor: Colors.card,
    borderRadius: Radii.full,
    paddingVertical: 8, paddingHorizontal: 16,
    ...Shadows.sm,
  },
  backBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primary },

  card: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    padding: 22, paddingBottom: 38,
    ...Shadows.md,
  },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 20, fontWeight: '700', color: Colors.text, letterSpacing: -0.3 },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
  statDivider: { width: 1, backgroundColor: Colors.divider, marginVertical: 4 },

  reasoningBox: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radii.md,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  reasoningText: {
    fontSize: 13, color: Colors.primaryDark, lineHeight: 19,
  },

  poiList: { marginBottom: 18 },
  poiListContent: { gap: 8, paddingRight: 4 },
  poiChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radii.full,
    paddingVertical: 6, paddingHorizontal: 12,
    borderWidth: 1, borderColor: Colors.primaryBorder,
  },
  poiChipNumber: {
    backgroundColor: Colors.primary,
    width: 18, height: 18,
    borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },
  poiChipNumberText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  poiChipIcon: { fontSize: 14 },
  poiChipName: { fontSize: 12, fontWeight: '600', color: Colors.primaryDark, maxWidth: 100 },

  startBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
    ...Shadows.md,
  },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  poiMarker: { alignItems: 'center' },
  poiMarkerIcon: { fontSize: 28 },
  poiMarkerBadge: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    width: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },
  poiMarkerNumber: { fontSize: 10, color: '#fff', fontWeight: '700' },
});
