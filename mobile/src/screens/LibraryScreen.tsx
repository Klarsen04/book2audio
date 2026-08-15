import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import api from '../lib/api';
import { theme } from '../lib/theme';

interface Document {
  id: string;
  title: string;
  format: string;
  status: string;
  audio_duration?: number;
  total_word_count?: number;
  created_at: string;
}

interface LibraryScreenProps {
  onSelectDocument: (doc: Document) => void;
}

export default function LibraryScreen({ onSelectDocument }: LibraryScreenProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const fetchLibrary = useCallback(async () => {
    try {
      const response = await api.get('/api/library');
      setDocuments(response.data.documents || []);
      setFetchError(false);
    } catch (error) {
      // Distinguish "couldn't reach the server" from a genuinely empty library.
      setFetchError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLibrary();
  }, [fetchLibrary]);

  const startConvert = async (item: Document) => {
    try {
      await api.post(`/api/convert/${item.id}?voice=Joanna&audio_type=full&intro=false`);
      Alert.alert('Converting', 'Your audiobook is on its way — pull down to refresh.');
      fetchLibrary();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      Alert.alert(
        'Could not convert',
        typeof detail === 'string' ? detail : detail?.message || 'Please try again.'
      );
    }
  };

  const handlePress = (item: Document) => {
    const status = item.status.toLowerCase();
    if (status === 'completed' || status === 'ready') {
      onSelectDocument(item);
      return;
    }
    if (status === 'converting' || status === 'queued' || status === 'processing') {
      Alert.alert('Still converting', 'This audiobook is not ready yet — pull down to refresh.');
      return;
    }
    // error / uploaded — offer a (re)convert instead of a dead player.
    Alert.alert(
      status === 'error' ? 'Conversion failed' : 'Not converted yet',
      status === 'error'
        ? 'The last conversion did not finish. Try converting it again?'
        : 'Convert this document to an audiobook now?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Convert', onPress: () => startConvert(item) },
      ]
    );
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins || 1}m`;
  };

  const statusColor = (status: string) =>
    ['completed', 'ready'].includes(status.toLowerCase())
      ? theme.gold
      : ['converting', 'processing', 'queued'].includes(status.toLowerCase())
      ? theme.goldSoft
      : ['error', 'failed'].includes(status.toLowerCase())
      ? theme.burgundy
      : theme.paper40;

  const renderItem = ({ item, index }: { item: Document; index: number }) => (
    <TouchableOpacity style={styles.row} onPress={() => handlePress(item)} activeOpacity={0.7}>
      <Text style={styles.index}>{String(index + 1).padStart(2, '0')}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.meta}>
          {item.format?.toUpperCase()} ·{' '}
          <Text style={{ color: statusColor(item.status) }}>{item.status}</Text>
        </Text>
      </View>
      <Text style={styles.duration}>
        {item.status === 'completed'
          ? formatDuration(item.audio_duration)
          : `${(item.total_word_count || 0).toLocaleString()} w`}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={fetchError ? [] : documents}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />
        }
        ListEmptyComponent={
          fetchError ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Couldn't load your library</Text>
              <Text style={styles.emptySubtitle}>
                Check your connection — your books are still safe on the server.
              </Text>
              <TouchableOpacity style={styles.retry} onPress={fetchLibrary}>
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Your library is empty</Text>
              <Text style={styles.emptySubtitle}>
                Head to Convert to turn your first document into audio.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg },
  list: { padding: 16 },
  sep: { height: 1, backgroundColor: theme.hairline },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 14 },
  index: {
    color: theme.gold,
    fontSize: 13,
    letterSpacing: 1,
    width: 26,
    fontVariant: ['tabular-nums'],
  },
  rowBody: { flex: 1 },
  title: { color: theme.paper, fontSize: 17, fontWeight: '600' },
  meta: {
    color: theme.paper40,
    fontSize: 12,
    marginTop: 3,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  duration: { color: theme.paper40, fontSize: 12, letterSpacing: 0.5 },
  empty: { alignItems: 'center', paddingTop: 100, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: theme.paper, marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: theme.paper60, textAlign: 'center', lineHeight: 22 },
  retry: {
    marginTop: 20,
    backgroundColor: theme.gold,
    borderRadius: theme.radius,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  retryText: { color: theme.ink, fontSize: 15, fontWeight: '700' },
});
