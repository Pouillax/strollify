import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Circle, Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { POI_CATEGORIES } from '@/constants/poi-categories';
import { Colors, Radii, Shadows } from '@/constants/theme';
import { computePersonalCadence, getWalks, saveWalk } from '@/services/history';
import { Coordinates, WalkConfig, WalkRecord, WalkRoute } from '@/types';

const DEFAULT_STEP_LENGTH = 0.75; // mètres par pas (plancher de base)

function distanceBetween(a: Coordinates, b: Coordinates): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function WalkScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ route: string; config: string; routeName?: string }>();
  const mapRef = useRef<MapView>(null);

  const route: WalkRoute = JSON.parse(params.route);
  const config: WalkConfig = JSON.parse(params.config);

  const [currentPos, setCurrentPos] = useState<Coordinates>(config.startCoordinates);
  const [distanceWalked, setDistanceWalked] = useState(0);
  const [stepsWalked, setStepsWalked] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [visitedPois, setVisitedPois] = useState<Set<string>>(new Set());
  const [finished, setFinished] = useState(false);

  const lastPosRef = useRef<Coordinates>(config.startCoordinates);
  const distanceRef = useRef(0);
  const stepsRef = useRef(0);
  const visitedPoisRef = useRef<Set<string>>(new Set());
  const startTimeRef = useRef(Date.now());
  const stepLengthRef = useRef(DEFAULT_STEP_LENGTH); // mètres par pas, mis à jour au mount
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Charger la cadence personnalisée avant de démarrer
    getWalks().then(walks => {
      const cadence = computePersonalCadence(walks); // pas/mètre
      stepLengthRef.current = 1 / cadence; // mètres/pas
    });

    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    (async () => {
      locationSubRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (loc) => {
          const newPos: Coordinates = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          const delta = distanceBetween(lastPosRef.current, newPos);
          lastPosRef.current = newPos;
          distanceRef.current += delta;
          stepsRef.current += Math.round(delta / stepLengthRef.current);
          setCurrentPos(newPos);
          setDistanceWalked(distanceRef.current);
          setStepsWalked(stepsRef.current);

          mapRef.current?.animateCamera({ center: newPos, zoom: 17 });

          // Vérifie si on est proche d'un POI (rayon 30m)
          route.waypoints.forEach(poi => {
            if (distanceBetween(newPos, poi.coordinates) < 30) {
              visitedPoisRef.current.add(poi.id);
              setVisitedPois(new Set(visitedPoisRef.current));
            }
          });

          // Vérifie si on a atteint la destination (rayon 30m)
          const dest = config.endCoordinates ?? config.startCoordinates;
          if (distanceBetween(newPos, dest) < 30 && distanceRef.current > 100) {
            setFinished(true);
          }
        }
      );
    })();

    return () => {
      locationSubRef.current?.remove();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleFinish = useCallback(async () => {
    const record: WalkRecord = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      savedAt: new Date().toISOString(),
      routeName: params.routeName ?? 'Promenade',
      stepsWalked: stepsRef.current,
      distanceMeters: distanceRef.current,
      durationSeconds: Math.floor((Date.now() - startTimeRef.current) / 1000),
      poisVisited: visitedPoisRef.current.size,
      totalPois: route.waypoints.length,
      config,
      route,
    };
    try { await saveWalk(record); } catch {}
    router.replace('/');
  }, [route, config, params.routeName, router]);

  const handleStop = () => {
    Alert.alert('Terminer la promenade ?', '', [
      { text: 'Continuer', style: 'cancel' },
      {
        text: 'Terminer',
        style: 'destructive',
        onPress: async () => {
          locationSubRef.current?.remove();
          if (timerRef.current) clearInterval(timerRef.current);
          await handleFinish();
        },
      },
    ]);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const progressPercent = Math.min(
    100,
    Math.round((stepsWalked / config.steps) * 100)
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        followsUserLocation
        initialRegion={{ ...config.startCoordinates, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
      >
        <Polyline
          coordinates={route.polylinePoints}
          strokeColor="#0a7ea4"
          strokeWidth={4}
          lineDashPattern={[10, 5]}
        />

        {route.waypoints.map((poi) => {
          const category = POI_CATEGORIES.find(c => c.id === poi.category);
          const visited = visitedPois.has(poi.id);
          return (
            <React.Fragment key={poi.id}>
              <Marker coordinate={poi.coordinates} title={poi.name}>
                <View style={[styles.poiMarker, visited && styles.poiMarkerVisited]}>
                  <Text style={styles.poiMarkerIcon}>{visited ? '✅' : (category?.icon ?? '📍')}</Text>
                </View>
              </Marker>
              <Circle
                center={poi.coordinates}
                radius={30}
                strokeColor={visited ? '#22c55e' : '#0a7ea4'}
                fillColor={visited ? '#22c55e22' : '#0a7ea422'}
              />
            </React.Fragment>
          );
        })}
      </MapView>

      {/* Stats overlay */}
      <View style={styles.statsOverlay}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stepsWalked.toLocaleString()}</Text>
          <Text style={styles.statLabel}>pas</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{(distanceWalked / 1000).toFixed(2)} km</Text>
          <Text style={styles.statLabel}>distance</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatTime(elapsedSeconds)}</Text>
          <Text style={styles.statLabel}>durée</Text>
        </View>
      </View>

      {/* Barre de progression */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` as any }]} />
        </View>
        <Text style={styles.progressText}>{progressPercent}% — objectif {config.steps.toLocaleString()} pas</Text>
        <Text style={styles.poiVisited}>{visitedPois.size}/{route.waypoints.length} lieux visités</Text>
      </View>

      {/* Bouton stop */}
      <Pressable style={styles.stopBtn} onPress={handleStop}>
        <Text style={styles.stopBtnText}>⏹ Terminer</Text>
      </Pressable>

      {/* Modale de fin */}
      {finished && (
        <View style={styles.finishedOverlay}>
          <View style={styles.finishedCard}>
            <Text style={styles.finishedEmoji}>🎉</Text>
            <Text style={styles.finishedTitle}>Promenade terminée !</Text>
            <Text style={styles.finishedStat}>{stepsWalked.toLocaleString()} pas · {(distanceWalked / 1000).toFixed(2)} km · {formatTime(elapsedSeconds)}</Text>
            <Text style={styles.finishedStat}>{visitedPois.size}/{route.waypoints.length} lieux visités</Text>
            <Pressable style={styles.finishedBtn} onPress={handleFinish}>
              <Text style={styles.finishedBtnText}>Retour à l'accueil</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  statsOverlay: {
    position: 'absolute', top: 56, left: 16, right: 16,
    flexDirection: 'row', backgroundColor: Colors.card,
    borderRadius: Radii.lg, padding: 14,
    ...Shadows.md,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: Colors.text, letterSpacing: -0.2 },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.divider, marginVertical: 4 },

  progressContainer: {
    position: 'absolute', bottom: 90, left: 16, right: 16,
    backgroundColor: Colors.card, borderRadius: Radii.lg, padding: 14,
    ...Shadows.md,
  },
  progressBg: { height: 6, backgroundColor: Colors.border, borderRadius: Radii.full, marginBottom: 8 },
  progressFill: { height: 6, backgroundColor: Colors.primary, borderRadius: Radii.full },
  progressText: { fontSize: 12, color: Colors.text, fontWeight: '500' },
  poiVisited: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },

  stopBtn: {
    position: 'absolute', bottom: 36, left: 16, right: 16,
    backgroundColor: Colors.error,
    borderRadius: Radii.lg,
    paddingVertical: 14, alignItems: 'center',
    ...Shadows.sm,
  },
  stopBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  poiMarker: { padding: 4, backgroundColor: Colors.card, borderRadius: 20 },
  poiMarkerVisited: { backgroundColor: Colors.primaryLight },
  poiMarkerIcon: { fontSize: 24 },

  finishedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(44,58,46,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },
  finishedCard: {
    backgroundColor: Colors.card,
    borderRadius: Radii.xl, padding: 28,
    alignItems: 'center', width: '82%',
    ...Shadows.md,
  },
  finishedEmoji: { fontSize: 48, marginBottom: 12 },
  finishedTitle: {
    fontSize: 22, fontWeight: '700',
    color: Colors.text, marginBottom: 8, letterSpacing: -0.3,
  },
  finishedStat: { fontSize: 14, color: Colors.textSecondary, marginBottom: 4 },
  finishedBtn: {
    marginTop: 20, backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    paddingVertical: 12, paddingHorizontal: 32,
  },
  finishedBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
