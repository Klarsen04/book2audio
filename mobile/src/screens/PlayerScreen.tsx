import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import api from '../lib/api';

interface Chapter {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
}

interface PlayerScreenProps {
  document: {
    id: string;
    title: string;
    duration?: number;
  };
  onBack: () => void;
}

const PLAYBACK_SPEEDS = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

export default function PlayerScreen({ document, onBack }: PlayerScreenProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAudio();
    fetchChapters();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const loadAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: `${api.defaults.baseURL}/api/audio/${document.id}/stream` },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      );
      setSound(newSound);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load audio:', error);
      setLoading(false);
    }
  };

  const fetchChapters = async () => {
    try {
      const response = await api.get(`/api/documents/${document.id}/chapters`);
      setChapters(response.data.chapters || []);
    } catch (error) {
      console.error('Failed to fetch chapters:', error);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis / 1000);
      setDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
      setIsPlaying(status.isPlaying);

      // Update current chapter
      const currentTime = status.positionMillis / 1000;
      const chapter = chapters.find(
        (ch) => currentTime >= ch.startTime && currentTime < ch.endTime
      );
      if (chapter) setCurrentChapter(chapter);
    }
  };

  const togglePlayPause = async () => {
    if (!sound) return;
    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  };

  const skipForward = async () => {
    if (!sound) return;
    const newPosition = Math.min(position + 30, duration) * 1000;
    await sound.setPositionAsync(newPosition);
  };

  const skipBackward = async () => {
    if (!sound) return;
    const newPosition = Math.max(position - 30, 0) * 1000;
    await sound.setPositionAsync(newPosition);
  };

  const changeSpeed = async () => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    const newSpeed = PLAYBACK_SPEEDS[nextIndex];
    setPlaybackSpeed(newSpeed);
    if (sound) {
      await sound.setRateAsync(newSpeed, true);
    }
  };

  const seekToChapter = async (chapter: Chapter) => {
    if (!sound) return;
    await sound.setPositionAsync(chapter.startTime * 1000);
    setCurrentChapter(chapter);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.loadingText}>Loading audio...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {document.title}
        </Text>
        <View style={styles.backButton} />
      </View>

      {/* Now Playing Info */}
      <View style={styles.nowPlaying}>
        <Text style={styles.documentTitle} numberOfLines={2}>
          {document.title}
        </Text>
        {currentChapter && (
          <Text style={styles.chapterTitle}>{currentChapter.title}</Text>
        )}
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(position)}</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={changeSpeed} style={styles.speedButton}>
          <Text style={styles.speedText}>{playbackSpeed}x</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={skipBackward} style={styles.skipButton}>
          <Text style={styles.skipText}>-30s</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={togglePlayPause} style={styles.playButton}>
          <Text style={styles.playText}>{isPlaying ? '||' : '▶'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={skipForward} style={styles.skipButton}>
          <Text style={styles.skipText}>+30s</Text>
        </TouchableOpacity>

        <View style={styles.speedButton} />
      </View>

      {/* Chapter List */}
      {chapters.length > 0 && (
        <View style={styles.chaptersSection}>
          <Text style={styles.chaptersTitle}>Chapters</Text>
          <ScrollView style={styles.chaptersList}>
            {chapters.map((chapter) => (
              <TouchableOpacity
                key={chapter.id}
                style={[
                  styles.chapterItem,
                  currentChapter?.id === chapter.id && styles.chapterItemActive,
                ]}
                onPress={() => seekToChapter(chapter)}
              >
                <Text
                  style={[
                    styles.chapterItemText,
                    currentChapter?.id === chapter.id && styles.chapterItemTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {chapter.title}
                </Text>
                <Text style={styles.chapterTime}>{formatTime(chapter.startTime)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
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
  loadingText: {
    color: '#aaa',
    marginTop: 16,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    width: 60,
  },
  backText: {
    color: '#7c3aed',
    fontSize: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  nowPlaying: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 32,
  },
  documentTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  chapterTitle: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
  },
  progressContainer: {
    paddingHorizontal: 32,
    marginBottom: 32,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#3a3a5a',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7c3aed',
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    color: '#888',
    fontSize: 12,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 32,
    marginBottom: 32,
  },
  speedButton: {
    width: 48,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedText: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '600',
  },
  skipButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2a2a4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playText: {
    color: '#fff',
    fontSize: 24,
  },
  chaptersSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  chaptersTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  chaptersList: {
    flex: 1,
  },
  chapterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  chapterItemActive: {
    backgroundColor: '#2a2a4a',
  },
  chapterItemText: {
    color: '#ccc',
    fontSize: 14,
    flex: 1,
    marginRight: 12,
  },
  chapterItemTextActive: {
    color: '#7c3aed',
    fontWeight: '600',
  },
  chapterTime: {
    color: '#888',
    fontSize: 12,
  },
});
