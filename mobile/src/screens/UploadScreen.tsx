import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import api, { getRestoreKey } from '../lib/api';
import { theme } from '../lib/theme';

type Phase = 'pick' | 'options' | 'converting' | 'done';

const AUDIO_TYPES = [
  { id: 'full', label: 'Full Text', desc: 'Reads the entire document.' },
  { id: 'long_summary', label: 'Long Summary', desc: 'Key sentences — about a third.' },
  { id: 'short_summary', label: 'Short Summary', desc: 'A concise overview.' },
];

const VOICES = ['Joanna', 'Matthew', 'Ruth', 'Stephen', 'Amy', 'Brian'];

export default function UploadScreen() {
  const [phase, setPhase] = useState<Phase>('pick');
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [audioType, setAudioType] = useState('full');
  const [intro, setIntro] = useState(false);
  const [voice, setVoice] = useState('Joanna');
  const [progress, setProgress] = useState(0);
  const [restoreKey, setRestoreKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [totalParts, setTotalParts] = useState(1);
  const [partsDone, setPartsDone] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollFailuresRef = useRef(0);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // Never let a poll tick (or its Alert) fire after leaving this screen.
  useEffect(() => stopPolling, []);

  const reset = () => {
    stopPolling();
    setPhase('pick');
    setFile(null);
    setJobId(null);
    setProgress(0);
    setTotalParts(1);
    setPartsDone(0);
  };

  const errorDetail = (e: any, fallback: string) => {
    const detail = e?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    return detail?.message || fallback;
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/epub+zip',
        'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      setFile(result.assets[0]);
    }
  };

  const uploadAndShowOptions = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        type: file.mimeType || 'application/octet-stream',
        name: file.name,
      } as any);
      // Let axios/RN set the multipart Content-Type (with boundary) itself;
      // parsing a big document can take a while, so give the upload more room
      // than the default 60s.
      const res = await api.post('/api/upload', formData, { timeout: 300000 });
      setJobId(res.data.job_id);
      setDocTitle(res.data.title || file.name);
      setPhase('options');
    } catch (e: any) {
      Alert.alert('Upload failed', errorDetail(e, 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const startConversion = async () => {
    if (!jobId) return;
    setPhase('converting');
    setProgress(0);
    try {
      const res = await api.post(
        `/api/convert/${jobId}?voice=${voice}&audio_type=${audioType}&intro=${intro}`
      );
      // Big books split into sibling part-documents; the audiobook is only
      // "ready" when every part has converted, so poll all of them.
      const partIds: string[] =
        res.data?.part_ids && res.data.part_ids.length > 0 ? res.data.part_ids : [jobId];
      setTotalParts(partIds.length);
      setPartsDone(0);

      const pending = new Set(partIds);
      pollFailuresRef.current = 0;
      stopPolling();

      const finish = async () => {
        stopPolling();
        setProgress(100);
        setRestoreKey(await getRestoreKey());
        setPhase('done');
      };

      pollRef.current = setInterval(async () => {
        // Parts convert one at a time within a session, so polling the first
        // still-pending part is enough per tick.
        const currentId = pending.values().next().value as string | undefined;
        if (!currentId) {
          finish();
          return;
        }
        try {
          const s = await api.get(`/api/status/${currentId}`);
          pollFailuresRef.current = 0;
          const doneCount = partIds.length - pending.size;
          if (s.data.status === 'completed') {
            pending.delete(currentId);
            setPartsDone(doneCount + 1);
            setProgress(Math.round(((doneCount + 1) / partIds.length) * 100));
            if (pending.size === 0) finish();
          } else if (s.data.status === 'error') {
            stopPolling();
            Alert.alert('Conversion failed', s.data.error || 'Please try again.');
            setPhase('options');
          } else {
            const partProgress = (s.data.progress || 0) / 100;
            setProgress(Math.round(((doneCount + partProgress) / partIds.length) * 100));
          }
        } catch {
          // Tolerate transient blips; conversion continues server-side.
          pollFailuresRef.current += 1;
          if (pollFailuresRef.current >= 3) {
            stopPolling();
            Alert.alert(
              'Lost connection',
              'Conversion continues on the server — check your Library shortly.'
            );
            reset();
          }
        }
      }, 2000);
    } catch (e: any) {
      Alert.alert('Could not start', errorDetail(e, 'Please try again.'));
      setPhase('options');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Turn a page into a voice</Text>
      <Text style={styles.sub}>PDF · EPUB · DOCX · TXT — chapters detected automatically.</Text>

      {phase === 'pick' && (
        <>
          <TouchableOpacity style={styles.dropzone} onPress={pickDocument} disabled={busy}>
            <Text style={styles.plus}>＋</Text>
            <Text style={styles.dzText}>{file ? file.name : 'Select a document'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primary, (!file || busy) && styles.disabled]}
            onPress={uploadAndShowOptions}
            disabled={!file || busy}
          >
            {busy ? <ActivityIndicator color={theme.ink} /> : <Text style={styles.primaryText}>Continue</Text>}
          </TouchableOpacity>
        </>
      )}

      {phase === 'options' && (
        <>
          <Text style={styles.docTitle}>{docTitle}</Text>

          <Text style={styles.section}>AUDIO TYPE</Text>
          {AUDIO_TYPES.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.option, audioType === t.id && styles.optionActive]}
              onPress={() => setAudioType(t.id)}
            >
              <Text style={[styles.optLabel, audioType === t.id && { color: theme.gold }]}>{t.label}</Text>
              <Text style={styles.optDesc}>{t.desc}</Text>
            </TouchableOpacity>
          ))}

          <View style={[styles.option, styles.introRow, intro && styles.optionActive]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.optLabel, intro && { color: theme.gold }]}>Start with a spoken summary</Text>
              <Text style={styles.optDesc}>
                Adds a short overview at the very start, then plays your selection in full.
              </Text>
            </View>
            <Switch
              value={intro}
              onValueChange={setIntro}
              trackColor={{ true: theme.gold, false: theme.hairlineStrong }}
              thumbColor={theme.paper}
            />
          </View>

          <Text style={styles.section}>VOICE</Text>
          <View style={styles.voiceWrap}>
            {VOICES.map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.voice, voice === v && styles.optionActive]}
                onPress={() => setVoice(v)}
              >
                <Text style={[styles.voiceText, voice === v && { color: theme.gold }]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.primary} onPress={startConversion}>
            <Text style={styles.primaryText}>Convert to audiobook</Text>
          </TouchableOpacity>
        </>
      )}

      {phase === 'converting' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.gold} />
          <Text style={styles.convText}>
            {totalParts > 1
              ? `Converting part ${Math.min(partsDone + 1, totalParts)} of ${totalParts}… ${progress}%`
              : `Converting… ${progress}%`}
          </Text>
          {totalParts > 1 && (
            <Text style={styles.sub}>
              Long books convert in parts — finished parts appear in your Library as they
              complete.
            </Text>
          )}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      )}

      {phase === 'done' && (
        <View style={styles.center}>
          <Text style={styles.doneTitle}>✓ Your audiobook is ready</Text>
          <Text style={styles.sub}>Find it in your Library.</Text>
          {restoreKey && (
            <View style={styles.keyBox}>
              <Text style={styles.keyLabel}>SAVE YOUR RESTORE KEY</Text>
              <Text style={styles.keyValue}>{restoreKey}</Text>
              <Text style={styles.keyHint}>No account needed — this is how you return to your library.</Text>
            </View>
          )}
          <TouchableOpacity style={styles.primary} onPress={reset}>
            <Text style={styles.primaryText}>Convert another</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 24, paddingTop: 16 },
  h1: { fontSize: 26, fontWeight: '700', color: theme.paper },
  sub: { fontSize: 14, color: theme.paper60, marginTop: 6, marginBottom: 24, lineHeight: 20 },
  dropzone: {
    borderWidth: 1,
    borderColor: theme.hairlineStrong,
    borderStyle: 'dashed',
    borderRadius: theme.radius,
    padding: 36,
    alignItems: 'center',
    backgroundColor: theme.surface,
    marginBottom: 20,
  },
  plus: { fontSize: 34, color: theme.gold, marginBottom: 10 },
  dzText: { color: theme.paper60, fontSize: 15 },
  docTitle: { fontSize: 20, fontWeight: '700', color: theme.paper, marginBottom: 20 },
  section: {
    color: theme.paper40,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 18,
    marginBottom: 10,
  },
  option: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.hairline,
    borderRadius: theme.radius,
    padding: 14,
    marginBottom: 8,
  },
  optionActive: { borderColor: theme.gold, backgroundColor: theme.goldTint },
  introRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  optLabel: { color: theme.paper, fontSize: 15, fontWeight: '600' },
  optDesc: { color: theme.paper40, fontSize: 12, marginTop: 4, lineHeight: 17 },
  voiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  voice: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.hairline,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  voiceText: { color: theme.paper60, fontSize: 14 },
  primary: {
    backgroundColor: theme.gold,
    borderRadius: theme.radius,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  primaryText: { color: theme.ink, fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  center: { alignItems: 'center', paddingTop: 40 },
  convText: { color: theme.paper, fontSize: 16, marginTop: 16, marginBottom: 12 },
  progressBar: {
    height: 6,
    width: '100%',
    backgroundColor: theme.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: theme.gold },
  doneTitle: { color: theme.gold, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  keyBox: {
    backgroundColor: theme.goldTint,
    borderWidth: 1,
    borderColor: theme.hairlineStrong,
    borderRadius: theme.radius,
    padding: 18,
    marginTop: 24,
    alignItems: 'center',
    width: '100%',
  },
  keyLabel: { color: theme.gold, fontSize: 11, letterSpacing: 2, marginBottom: 8 },
  keyValue: {
    color: theme.paper,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  keyHint: { color: theme.paper60, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
