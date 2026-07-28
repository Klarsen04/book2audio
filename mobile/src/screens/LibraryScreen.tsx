import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import api from '../lib/api';

interface Document {
  id: string;
  title: string;
  format: string;
  status: string;
  duration?: number;
  created_at: string;
}

interface LibraryScreenProps {
  onSelectDocument: (doc: Document) => void;
}

export default function LibraryScreen({ onSelectDocument }: LibraryScreenProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLibrary = useCallback(async () => {
    try {
      const response = await api.get('/api/library');
      setDocuments(response.data.documents || response.data || []);
    } catch (error) {
      console.error('Failed to fetch library:', error);
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

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'ready':
        return '#10b981';
      case 'processing':
      case 'converting':
        return '#f59e0b';
      case 'failed':
      case 'error':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getFormatBadgeColor = (format: string) => {
    switch (format.toLowerCase()) {
      case 'pdf':
        return '#ef4444';
      case 'epub':
        return '#3b82f6';
      case 'txt':
        return '#6b7280';
      default:
        return '#7c3aed';
    }
  };

  const renderItem = ({ item }: { item: Document }) => (
    <TouchableOpacity style={styles.card} onPress={() => onSelectDocument(item)}>
      <View style={styles.cardHeader}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={[styles.formatBadge, { backgroundColor: getFormatBadgeColor(item.format) }]}>
          <Text style={styles.formatText}>{item.format.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
        <Text style={styles.duration}>{formatDuration(item.duration)}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={documents}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#7c3aed"
            colors={['#7c3aed']}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No books yet</Text>
            <Text style={styles.emptySubtitle}>
              Upload a book to get started with audio conversion
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#2a2a4a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a3a5a',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    marginRight: 12,
  },
  formatBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  formatText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: '#aaa',
    fontSize: 13,
    textTransform: 'capitalize',
  },
  duration: {
    color: '#aaa',
    fontSize: 13,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});
