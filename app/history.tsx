import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Colors, Radii, Shadows } from '@/constants/theme';
import { deleteWalk, getWalks, toggleFavorite } from '@/services/history';
import { WalkRecord } from '@/types';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m} min`;
}

function WalkCard({
  record,
  onReplay,
  onDelete,
  onToggleFavorite,
}: {
  record: WalkRecord;
  onReplay: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <View style={[styles.card, record.isFavorite && styles.cardFavorite]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.cardName} numberOfLines={1}>{record.routeName}</Text>
          <Text style={styles.cardDate}>{formatDate(record.savedAt)}</Text>
        </View>
        <View style={styles.cardActions}>
          <Pressable
            style={[styles.actionBtn, record.isFavorite && styles.actionBtnActive]}
            onPress={onToggleFavorite}
            hitSlop={8}
          >
            <Text style={styles.actionBtnText}>{record.isFavorite ? '★' : '☆'}</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={onDelete} hitSlop={8}>
            <Text style={styles.actionBtnText}>✕</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{record.stepsWalked.toLocaleString('fr-FR')}</Text>
          <Text style={styles.statLabel}>pas</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{(record.distanceMeters / 1000).toFixed(2)} km</Text>
          <Text style={styles.statLabel}>distance</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatDuration(record.durationSeconds)}</Text>
          <Text style={styles.statLabel}>durée</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{record.poisVisited}/{record.totalPois}</Text>
          <Text style={styles.statLabel}>lieux</Text>
        </View>
      </View>

      <Pressable style={styles.replayBtn} onPress={onReplay}>
        <Text style={styles.replayBtnText}>↺  Refaire ce parcours</Text>
      </Pressable>
    </View>
  );
}

type FilterMode = 'all' | 'favorites';

export default function HistoryScreen() {
  const router = useRouter();
  const [walks, setWalks] = useState<WalkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');

  const loadWalks = useCallback(async () => {
    setLoading(true);
    const data = await getWalks();
    setWalks(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadWalks();
  }, [loadWalks]);

  const handleDelete = useCallback((id: string) => {
    Alert.alert(
      'Supprimer cette promenade ?',
      'Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteWalk(id);
            setWalks(prev => prev.filter(w => w.id !== id));
          },
        },
      ]
    );
  }, []);

  const handleToggleFavorite = useCallback(async (id: string) => {
    await toggleFavorite(id);
    setWalks(prev =>
      prev.map(w => w.id === id ? { ...w, isFavorite: !w.isFavorite } : w)
    );
  }, []);

  const handleReplay = useCallback((record: WalkRecord) => {
    router.push({
      pathname: '/route-preview',
      params: {
        route: JSON.stringify(record.route),
        config: JSON.stringify(record.config),
        routeName: record.routeName,
        reasoning: '',
      },
    });
  }, [router]);

  const displayed = filter === 'favorites' ? walks.filter(w => w.isFavorite) : walks;
  const favCount = walks.filter(w => w.isFavorite).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Retour</Text>
        </Pressable>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Mes promenades</Text>
          <View style={styles.filterToggle}>
            <Pressable
              style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.filterBtnText, filter === 'all' && styles.filterBtnTextActive]}>
                Tout ({walks.length})
              </Text>
            </Pressable>
            <Pressable
              style={[styles.filterBtn, filter === 'favorites' && styles.filterBtnActive]}
              onPress={() => setFilter('favorites')}
            >
              <Text style={[styles.filterBtnText, filter === 'favorites' && styles.filterBtnTextActive]}>
                ★ Favoris ({favCount})
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {!loading && displayed.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>{filter === 'favorites' ? '★' : '🥾'}</Text>
          <Text style={styles.emptyTitle}>
            {filter === 'favorites' ? 'Aucun favori' : 'Aucune promenade enregistrée'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {filter === 'favorites'
              ? 'Appuyez sur ☆ sur une promenade pour l\'ajouter à vos favoris.'
              : 'Terminez votre première promenade pour la voir apparaître ici.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <WalkCard
              record={item}
              onReplay={() => handleReplay(item)}
              onDelete={() => handleDelete(item.id)}
              onToggleFavorite={() => handleToggleFavorite(item.id)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.3,
  },

  filterToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 2,
  },
  filterBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radii.full,
  },
  filterBtnActive: { backgroundColor: Colors.primary },
  filterBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  filterBtnTextActive: { color: '#fff' },

  listContent: { padding: 16, gap: 14, paddingBottom: 48 },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radii.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 18,
    ...Shadows.sm,
  },
  cardFavorite: {
    borderColor: '#F5A623',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  cardHeaderLeft: { flex: 1, marginRight: 10 },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  cardDate: { fontSize: 12, color: Colors.textSecondary },
  cardActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: Radii.sm,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnActive: {
    backgroundColor: '#FFF8E6',
    borderColor: '#F5A623',
  },
  actionBtnText: { fontSize: 13, color: Colors.textMuted },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: Radii.md,
    padding: 12,
    marginBottom: 14,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 15, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.divider, marginVertical: 2 },

  replayBtn: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radii.md,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  replayBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primaryDark },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
