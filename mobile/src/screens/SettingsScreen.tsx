import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getRestoreKey, restoreSession, signOutSession, fetchSession } from '../lib/api';
import { theme } from '../lib/theme';

export default function SettingsScreen() {
  const [restoreKey, setRestoreKey] = useState<string | null>(null);
  const [docCount, setDocCount] = useState(0);
  const [keyInput, setKeyInput] = useState('');
  const [restoring, setRestoring] = useState(false);

  const load = async () => {
    setRestoreKey(await getRestoreKey());
    try {
      const s = await fetchSession();
      setDocCount(s.document_count || 0);
    } catch {}
  };

  useEffect(() => {
    load();
  }, []);

  const copyKey = async () => {
    if (!restoreKey) return;
    await Clipboard.setStringAsync(restoreKey);
    Alert.alert('Copied', 'Your restore key is on the clipboard. Keep it safe.');
  };

  const handleRestore = async () => {
    if (!keyInput.trim()) return;
    setRestoring(true);
    try {
      await restoreSession(keyInput);
      setKeyInput('');
      await load();
      Alert.alert('Restored', 'Your library has been restored on this device.');
    } catch (e: any) {
      Alert.alert('Restore failed', e.response?.data?.detail || "That key didn't match a saved library.");
    } finally {
      setRestoring(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Your library stays safe — restore it anytime with your key.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOutSession();
          setRestoreKey(null);
          setDocCount(0);
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingTop: 20 }}>
      <Text style={styles.section}>YOUR SESSION</Text>
      {restoreKey ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Restore key</Text>
          <Text style={styles.key}>{restoreKey}</Text>
          <Text style={styles.hint}>
            {docCount} {docCount === 1 ? 'book' : 'books'} · No account needed — save this key to
            return to your library on any device.
          </Text>
          <TouchableOpacity style={styles.primary} onPress={copyKey}>
            <Text style={styles.primaryText}>Copy key</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.hint}>
            No session yet. Convert a document to start one, or restore an existing library below.
          </Text>
        </View>
      )}

      <Text style={styles.section}>RESTORE A LIBRARY</Text>
      <View style={styles.card}>
        <TextInput
          value={keyInput}
          onChangeText={setKeyInput}
          placeholder="PAGE-XXXX-XXXX-XXXX"
          placeholderTextColor={theme.paper40}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.input}
        />
        <TouchableOpacity
          style={[styles.primary, (!keyInput.trim() || restoring) && styles.disabled]}
          onPress={handleRestore}
          disabled={!keyInput.trim() || restoring}
        >
          <Text style={styles.primaryText}>{restoring ? 'Restoring…' : 'Restore my library'}</Text>
        </TouchableOpacity>
      </View>

      {restoreKey && (
        <TouchableOpacity style={styles.signout} onPress={handleSignOut}>
          <Text style={styles.signoutText}>Sign out on this device</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.section}>ABOUT</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowText}>Version</Text>
          <Text style={styles.rowValue}>1.0.0</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  section: {
    color: theme.paper40,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 20,
    marginBottom: 10,
  },
  card: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.hairline,
    borderRadius: theme.radius,
    padding: 18,
  },
  cardLabel: { color: theme.paper40, fontSize: 12, letterSpacing: 1, marginBottom: 6 },
  key: { color: theme.gold, fontSize: 22, fontWeight: '700', letterSpacing: 2, marginBottom: 10 },
  hint: { color: theme.paper60, fontSize: 13, lineHeight: 19 },
  input: {
    backgroundColor: theme.ink,
    borderWidth: 1,
    borderColor: theme.hairline,
    borderRadius: theme.radius,
    padding: 14,
    color: theme.paper,
    fontSize: 16,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 12,
  },
  primary: {
    backgroundColor: theme.gold,
    borderRadius: theme.radius,
    padding: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  primaryText: { color: theme.ink, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  signout: { padding: 16, alignItems: 'center', marginTop: 8 },
  signoutText: { color: theme.burgundy, fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowText: { color: theme.paper, fontSize: 15 },
  rowValue: { color: theme.paper40, fontSize: 15 },
});
