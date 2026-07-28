import React, { useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { NativeRichTextDisplay } from '@/components/shared/rich-text/native-rich-text-display';
import { NativeRichTextEditor } from '@/components/shared/rich-text/native-rich-text-editor';
import {
  RichTextEditorProvider,
  useRichTextEditorCoordinator,
} from '@/components/shared/rich-text/rich-text-editor-provider';
import { RichTextKeyboardToolbar } from '@/components/shared/rich-text/rich-text-keyboard-toolbar';
import { NativeRichTextKeyboardAwareScrollView } from '@/components/shared/rich-text/native-rich-text-keyboard';
import type { NativeRichTextEditorRef } from '@/components/shared/rich-text/rich-text-types';
import {
  getRichTextDiagnosticsSnapshot,
  resetRichTextDiagnostics,
  type RichTextDiagnosticsSnapshot,
} from '@/components/shared/rich-text/rich-text-diagnostics';

const SAMPLE_PROMPT_HTML = '<p><strong>What mattered today?</strong></p><p>Notice where grace met your work.</p>';
const SAMPLE_LIST_HTML = '<p>Tomorrow:</p><ul><li>Pray before planning</li><li>Begin the important work</li></ul>';
const LONG_DOCUMENT_WORDS = [
  'grace', 'attention', 'prayer', 'work', 'patience', 'clarity', 'service', 'truth',
  'discipline', 'hope', 'wisdom', 'courage', 'rest', 'purpose', 'faith', 'love',
] as const;

function buildLongDocument(targetWords: number) {
  const words = Array.from(
    { length: targetWords },
    (_, index) => LONG_DOCUMENT_WORDS[index % LONG_DOCUMENT_WORDS.length],
  );
  const paragraphs: string[] = [];
  for (let index = 0; index < words.length; index += 80) {
    paragraphs.push(`<p>${words.slice(index, index + 80).join(' ')}.</p>`);
  }
  return paragraphs.join('');
}

function flushPreview(values: Record<string, string>) {
  return JSON.stringify(Object.fromEntries(
    Object.entries(values).map(([editorId, html]) => [editorId, {
      characters: html.length,
      preview: html.length > 700 ? `${html.slice(0, 700)}…` : html,
    }]),
  ), null, 2);
}

function diagnosticsSummary(snapshot: RichTextDiagnosticsSnapshot) {
  const editorMetrics = Object.values(snapshot.editors);
  return {
    editors: editorMetrics.length,
    renders: editorMetrics.reduce((sum, metric) => sum + metric.renderCount, 0),
    dirtyEvents: editorMetrics.reduce(
      (sum, metric) => sum + (metric.dirtyEventCount ?? 0),
      0,
    ),
    failures: editorMetrics.reduce((sum, metric) => sum + metric.flushFailureCount, 0),
    maxKeyboardMs: Math.max(0, ...editorMetrics.map(metric => metric.maxKeyboardLatencyMs ?? 0)),
    maxFlushMs: Math.max(0, ...editorMetrics.map(metric => metric.maxFlushDurationMs ?? 0)),
  };
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.metricTile}>
      <Text selectable style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricName}>{label}</Text>
    </View>
  );
}

function LabContent() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const freeWritingRef = useRef<NativeRichTextEditorRef>(null);
  const [savedPreview, setSavedPreview] = useState('Nothing flushed yet.');
  const [loadedScenario, setLoadedScenario] = useState('Blank hydration');
  const [diagnostics, setDiagnostics] = useState(getRichTextDiagnosticsSnapshot);
  const { flushAll } = useRichTextEditorCoordinator();
  const summary = useMemo(() => diagnosticsSummary(diagnostics), [diagnostics]);

  const refreshDiagnostics = () => {
    setDiagnostics(getRichTextDiagnosticsSnapshot());
  };

  const flush = async () => {
    const values = await flushAll();
    setSavedPreview(flushPreview(values));
    setDiagnostics(getRichTextDiagnosticsSnapshot());
  };

  const loadLongDocument = (wordCount: number) => {
    freeWritingRef.current?.setHTML(buildLongDocument(wordCount), false);
    setLoadedScenario(`${wordCount.toLocaleString()} programmatic words`);
  };

  const clearFreeWriting = () => {
    freeWritingRef.current?.setHTML('', false);
    setLoadedScenario('Blank programmatic hydration');
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <ChevronLeft s={22} c={C.text} w={2.2} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>PHYSICAL DEVICE GATE</Text>
          <Text style={styles.title}>Native journal editor</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Flush all editor content"
          onPress={() => { void flush(); }}
          style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
        >
          <Text style={styles.saveText}>Flush</Text>
        </Pressable>
      </View>

      <NativeRichTextKeyboardAwareScrollView
        bottomOffset={64}
        disableScrollOnKeyboardHide
        keyboardDismissMode="none"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 112 },
        ]}
      >
        <View style={styles.runtimeCard}>
          <Text style={styles.cardLabel}>ACTIVE NATIVE BUILD</Text>
          <Text selectable style={styles.runtimeValue}>
            {`${process.env.EXPO_OS ?? 'native'} · ${Math.round(width)} pt · editor flag ON`}
          </Text>
          <Text style={styles.runtimeBody}>
            One toolbar must follow the software keyboard. It must disappear for the normal input below and reserve no empty space after Done.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>NORMAL TEXT INPUT — NEGATIVE CONTROL</Text>
          <TextInput
            accessibilityLabel="Normal text input without rich formatting toolbar"
            defaultValue="Tap here: the rich toolbar must stay hidden."
            multiline
            style={styles.normalInput}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>REFLECTION — MIXED FORMATTING</Text>
          <NativeRichTextEditor
            editorId="lab:reflection"
            initialHTML={SAMPLE_PROMPT_HTML}
            autoHeight
            minHeight={144}
            placeholder="Write an honest reflection..."
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>NEXT STEPS — LIST BEHAVIOR</Text>
          <NativeRichTextEditor
            editorId="lab:next-steps"
            initialHTML={SAMPLE_LIST_HTML}
            autoHeight
            minHeight={144}
            placeholder="Add a practical next step..."
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>READ-ONLY PARITY</Text>
          <NativeRichTextDisplay
            html={SAMPLE_LIST_HTML}
            backgroundColor="#FFFFFF"
            color={C.text}
            minHeight={118}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.longHeader}>
            <View style={styles.longCopy}>
              <Text style={styles.cardLabel}>FREE WRITING — LONG DOCUMENT</Text>
              <Text selectable style={styles.scenarioText}>{loadedScenario}</Text>
            </View>
            <View style={styles.scenarioButtons}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Load one thousand word test document"
                onPress={() => loadLongDocument(1000)}
                style={({ pressed }) => [styles.scenarioButton, pressed && styles.pressed]}
              >
                <Text style={styles.scenarioButtonText}>1K</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Load five thousand word test document"
                onPress={() => loadLongDocument(5000)}
                style={({ pressed }) => [styles.scenarioButton, pressed && styles.pressed]}
              >
                <Text style={styles.scenarioButtonText}>5K</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear long document editor"
                onPress={clearFreeWriting}
                style={({ pressed }) => [styles.scenarioButton, pressed && styles.pressed]}
              >
                <Text style={styles.scenarioButtonText}>CLEAR</Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.testHint}>
            Loading and clearing are non-dirty hydration operations. Refresh metrics before and after; only real typing or toolbar formatting should add dirty events.
          </Text>
          <NativeRichTextEditor
            ref={freeWritingRef}
            editorId="lab:free-writing"
            autoHeight
            minHeight={300}
            placeholder="Keep writing long enough to test the caret below the fold..."
          />
        </View>

        <View style={styles.outputCard}>
          <View style={styles.metricsHeader}>
            <Text style={[styles.cardLabel, styles.metricsLabel]}>DEVICE METRICS</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh rich-text diagnostics"
              onPress={refreshDiagnostics}
              style={({ pressed }) => [styles.metricsButton, pressed && styles.pressed]}
            >
              <Text style={styles.metricsButtonText}>REFRESH</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset rich-text diagnostics"
              onPress={() => {
                resetRichTextDiagnostics();
                setDiagnostics(getRichTextDiagnosticsSnapshot());
              }}
              style={({ pressed }) => [styles.metricsButton, pressed && styles.pressed]}
            >
              <Text style={styles.metricsButtonText}>RESET</Text>
            </Pressable>
          </View>
          <View style={styles.metricGrid}>
            <MetricTile label="EDITORS" value={summary.editors} />
            <MetricTile label="RENDERS" value={summary.renders} />
            <MetricTile label="DIRTY EVENTS" value={summary.dirtyEvents} />
            <MetricTile label="FLUSH FAILURES" value={summary.failures} />
            <MetricTile label="MAX KEYBOARD" value={`${Math.round(summary.maxKeyboardMs)} ms`} />
            <MetricTile label="MAX FLUSH" value={`${Math.round(summary.maxFlushMs)} ms`} />
          </View>
          <Text selectable style={styles.output}>{JSON.stringify(diagnostics, null, 2)}</Text>
        </View>

        <View style={styles.outputCard}>
          <Text style={styles.cardLabel}>LAST FLUSHED HTML</Text>
          <Text style={styles.testHint}>
            The preview is intentionally truncated; character counts prove which large document was serialized without making this QA screen itself render 5,000 words.
          </Text>
          <Text selectable style={styles.output}>{savedPreview}</Text>
        </View>
      </NativeRichTextKeyboardAwareScrollView>

      <RichTextKeyboardToolbar />
    </View>
  );
}

function DisabledLab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.disabled, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.title}>Native editor is not in Expo Go</Text>
      <Text style={styles.runtimeBody}>
        Open this route in the Anasta development client. Expo Go intentionally keeps the legacy path and cannot verify native keyboard or editor behavior.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        style={({ pressed }) => [styles.disabledButton, pressed && styles.pressed]}
      >
        <Text style={styles.disabledButtonText}>Go back</Text>
      </Pressable>
    </View>
  );
}

export function RichTextLabView({ nativeEditorEnabled }: { nativeEditorEnabled: boolean }) {
  if (!nativeEditorEnabled) return <DisabledLab />;
  return (
    <RichTextEditorProvider>
      <LabContent />
    </RichTextEditorProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F3EC' },
  header: {
    minHeight: 92,
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(55,45,34,0.12)',
    backgroundColor: '#FCF9F3',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  eyebrow: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8, color: C.gold },
  title: { fontFamily: F.serifBold, fontSize: 24, lineHeight: 29, color: C.text },
  saveButton: {
    minWidth: 58,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.text,
  },
  saveText: { fontFamily: F.sansSemiBold, fontSize: 13, color: '#FFFFFF' },
  content: { padding: 16, rowGap: 14 },
  runtimeCard: {
    paddingBottom: 14,
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.28)',
    backgroundColor: '#FFF9EC',
  },
  runtimeValue: {
    paddingHorizontal: 14,
    paddingTop: 8,
    fontFamily: F.serifBold,
    fontSize: 19,
    lineHeight: 24,
    color: C.text,
  },
  runtimeBody: {
    paddingHorizontal: 14,
    paddingTop: 7,
    fontFamily: F.sans,
    fontSize: 15,
    lineHeight: 22,
    color: C.textSecondary,
  },
  card: {
    overflow: 'hidden',
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(55,45,34,0.10)',
    backgroundColor: '#FFFFFF',
  },
  cardLabel: {
    paddingTop: 14,
    paddingHorizontal: 14,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: C.gold,
  },
  normalInput: {
    minHeight: 88,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: F.serif,
    fontSize: 17,
    lineHeight: 27,
    color: C.text,
    textAlignVertical: 'top',
  },
  longHeader: {
    rowGap: 8,
  },
  longCopy: {},
  scenarioText: {
    paddingHorizontal: 14,
    paddingTop: 4,
    fontFamily: F.sansSemiBold,
    fontSize: 12,
    color: C.textSecondary,
  },
  scenarioButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 4,
    paddingHorizontal: 8,
  },
  scenarioButton: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: 7,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scenarioButtonText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: C.gold,
  },
  testHint: {
    paddingHorizontal: 14,
    paddingTop: 8,
    fontFamily: F.sans,
    fontSize: 13,
    lineHeight: 19,
    color: C.textSecondary,
  },
  outputCard: {
    minHeight: 150,
    paddingBottom: 14,
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(55,45,34,0.10)',
    backgroundColor: '#EFE9DE',
  },
  output: {
    padding: 14,
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 18,
    color: C.textSecondary,
  },
  metricsHeader: {
    minHeight: 54,
    paddingLeft: 14,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
  },
  metricsLabel: { flex: 1, paddingTop: 0, paddingHorizontal: 0 },
  metricsButton: {
    minWidth: 54,
    height: 44,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsButtonText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.1,
    color: C.gold,
  },
  metricGrid: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricTile: {
    minWidth: '30%',
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.70)',
  },
  metricValue: {
    fontFamily: F.sansBold,
    fontSize: 16,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
    color: C.text,
  },
  metricName: {
    paddingTop: 2,
    fontFamily: F.sansBold,
    fontSize: 8,
    letterSpacing: 1,
    color: C.textSecondary,
  },
  pressed: { opacity: 0.62 },
  disabled: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    rowGap: 18,
    backgroundColor: '#F7F3EC',
  },
  disabledButton: {
    height: 50,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.text,
  },
  disabledButtonText: { fontFamily: F.sansSemiBold, fontSize: 15, color: '#FFFFFF' },
});
