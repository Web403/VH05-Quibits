/**
 * Machine QR scanner.
 *
 * Flow: permission → camera → scan → validate locally → resolve via the
 * backend → confirm the machine (bottom sheet) → open machine details.
 *
 * Rules that keep this safe in the field:
 *  - The camera scans QR codes only (`barcodeTypes: ['qr']`).
 *  - Detection is latched: the first barcode pauses scanning until the
 *    technician dismisses the outcome. The same code can never fire twice,
 *    and there are no repeated beeps/vibrations/alerts - one haptic tap on a
 *    successful resolution, nothing otherwise.
 *  - The QR value is only an identifier. Authorization, organization
 *    isolation and even existence are decided by
 *    GET /machines/resolve-qr/:qrValue; unknown and unauthorized machines
 *    look identical here, exactly as the backend reports them.
 *  - Damaged labels have a first-class escape: manual machine-code entry goes
 *    through the SAME resolution flow (`resolve` is shared), never a
 *    parallel lookup.
 *  - The camera is unmounted when the screen loses focus (battery, and the
 *    privacy contract that the app never watches in the background).
 */
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme, useThemedStyles } from '@/theme/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { resolveMachineQr } from '@/api/endpoints';
import type { MachineQrSummary } from '@/api/types';
import { canonicalQrValue, describeQrResolveError, invalidQrMessage, type QrResolveProblem } from '@/lib/qr';
import { Button, Card, TextField } from '@/components/ui';
import { MachineConfirmSheet } from '@/components/machine-confirm-sheet';
import { elevation, hitSlop, iconSize, radius, spacing, type as typeScale } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';

/** Scanner lifecycle, named once so tests can follow each state. */
type ScanPhase =
  | 'permission-loading'
  | 'permission-prompt'
  | 'permission-denied' // can ask again
  | 'permission-blocked' // permanently denied - only Settings can fix it
  | 'scanning'
  | 'resolving'
  | 'camera-error';

export default function ScanMachineScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<ScanPhase>('permission-loading');
  const [problem, setProblem] = useState<QrResolveProblem | null>(null);
  const [machine, setMachine] = useState<MachineQrSummary | null>(null);
  const [manualVisible, setManualVisible] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [focused, setFocused] = useState(true);

  // Latch: once a barcode is accepted for processing, the scanner is
  // logically off until resume() clears it. Duplicate scan prevention lives
  // here AND in the phase machine (belt and braces).
  const resolvingRef = useRef(false);
  const lastValueRef = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    if (!permission) {
      setPhase('permission-loading');
    } else if (permission.granted) {
      setPhase((current) => (current === 'permission-loading' || current === 'permission-prompt' ? 'scanning' : current));
    } else if (!permission.canAskAgain) {
      setPhase('permission-blocked');
    } else {
      setPhase('permission-prompt');
    }
  }, [permission]);

  const resolve = useCallback(async (rawValue: string) => {
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    lastValueRef.current = rawValue;
    setProblem(null);
    setPhase('resolving');
    try {
      const summary = await resolveMachineQr(rawValue);
      // One success haptic, exactly once per resolved machine.
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setMachine(summary);
    } catch (error) {
      setProblem(describeQrResolveError(error));
      setPhase('scanning');
      resolvingRef.current = false;
      lastValueRef.current = null;
    }
  }, []);

  const handleBarcode = useCallback(
    (result: BarcodeScanningResult) => {
      if (phase !== 'scanning' || resolvingRef.current) return;
      const data = result?.data ?? '';
      if (!data || data === lastValueRef.current) return;

      const canonical = canonicalQrValue(data);
      if (!canonical) {
        // Invalid QR: local feedback, no backend call, no haptic storm.
        setProblem({ title: 'Not a machine code', message: invalidQrMessage(data), retryable: false });
        lastValueRef.current = data; // don't re-flag the same bad code every frame
        return;
      }
      void resolve(canonical);
    },
    [phase, resolve],
  );

  const resume = useCallback(() => {
    setProblem(null);
    setMachine(null);
    lastValueRef.current = null;
    resolvingRef.current = false;
    setPhase('scanning');
  }, []);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/(tabs)/home');
  }, []);

  const submitManual = useCallback(() => {
    const canonical = canonicalQrValue(manualCode);
    if (!canonical) {
      setManualError('Enter the machine code from the label, e.g. CNC-001.');
      return;
    }
    setManualVisible(false);
    setManualCode('');
    setManualError(null);
    void resolve(canonical);
  }, [manualCode, resolve]);

  const busy = phase === 'resolving';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {phase === 'permission-loading' ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.centerText}>Preparing the scanner…</Text>
        </View>
      ) : null}

      {phase === 'permission-prompt' ? (
        <View style={styles.center} testID="scan-permission-prompt">
          <Text style={styles.title}>Camera access needed</Text>
          <Text style={styles.centerText}>
            The camera is used only to read machine QR codes. Nothing is recorded or uploaded.
          </Text>
          <Button
            label="Allow camera access"
            size="lg"
            onPress={() => void requestPermission()}
            testID="scan-permission-allow"
          />
          <View style={{ height: spacing.sm }} />
          <Button label="Enter machine code instead" variant="secondary" onPress={() => setManualVisible(true)} />
        </View>
      ) : null}

      {phase === 'permission-blocked' ? (
        <View style={styles.center} testID="scan-permission-blocked">
          <Text style={styles.title}>Camera is turned off</Text>
          <Text style={styles.centerText}>
            Camera access was declined earlier and can only be re-enabled in the device settings:
            Settings → Apps → Expo Go → Permissions → Camera. You can still find machines by code.
          </Text>
          <Button label="Enter machine code instead" size="lg" onPress={() => setManualVisible(true)} />
        </View>
      ) : null}

      {phase === 'camera-error' ? (
        <View style={styles.center} testID="scan-camera-error">
          <Text style={styles.title}>Camera unavailable</Text>
          <Text style={styles.centerText}>
            The camera could not be started on this device. You can still find machines by code.
          </Text>
          <Button label="Try again" variant="secondary" onPress={() => setPhase('scanning')} style={{ marginBottom: spacing.sm }} />
          <Button label="Enter machine code instead" onPress={() => setManualVisible(true)} />
        </View>
      ) : null}

      {permission?.granted && phase !== 'camera-error' && focused ? (
        <View style={styles.cameraWrap} testID="scan-camera">
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            active={phase === 'scanning'}
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={phase === 'scanning' ? handleBarcode : undefined}
            onMountError={() => setPhase('camera-error')}
          />
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.topBar} pointerEvents="box-none">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close scanner"
                onPress={close}
                hitSlop={hitSlop}
                style={styles.roundButton}
                testID="scan-close"
              >
                <Text style={styles.roundButtonIcon} aria-hidden>✕</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={torch ? 'Turn flashlight off' : 'Turn flashlight on'}
                accessibilityState={{ selected: torch }}
                onPress={() => setTorch((value) => !value)}
                hitSlop={hitSlop}
                style={[styles.roundButton, torch && styles.roundButtonActive]}
                testID="scan-torch"
              >
                <Text style={styles.roundButtonIcon} aria-hidden>⚡</Text>
              </Pressable>
            </View>

            <View style={styles.frameArea} pointerEvents="none">
              <View style={styles.frame} />
              <Text style={styles.instruction}>Align the machine QR code inside the frame.</Text>
            </View>

            <View style={styles.bottomBar} pointerEvents="box-none">
              {problem ? (
                <View style={styles.problemBox} testID="scan-problem">
                  <Text style={styles.problemTitle}>{problem.title}</Text>
                  <Text style={styles.problemText}>{problem.message}</Text>
                  {problem.retryable ? (
                    <Button label="Try again" variant="secondary" onPress={resume} testID="scan-retry" />
                  ) : (
                    <Button label="Scan another code" variant="secondary" onPress={resume} testID="scan-resume" />
                  )}
                </View>
              ) : null}
              {busy ? (
                <View style={styles.resolvingBox} testID="scan-resolving">
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.resolvingText}>Checking the machine…</Text>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Enter machine code manually"
                onPress={() => setManualVisible(true)}
                style={styles.manualButton}
                testID="scan-manual"
              >
                <Text style={styles.manualButtonText}>QR code damaged? Enter the machine code</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {machine ? (
        <MachineConfirmSheet
          machine={machine}
          testID="scan-confirm"
          onOpen={() => {
            setMachine(null);
            router.push(`/(app)/machines/${machine.id}`);
            // Keep the latch: when the user comes BACK here the scanner
            // resumes from a clean slate via useFocusEffect + state below.
            setProblem(null);
            lastValueRef.current = null;
            resolvingRef.current = false;
            setPhase('scanning');
          }}
          onScanAgain={resume}
        />
      ) : null}

      {/* Manual machine code entry - the damaged-label fallback. Same flow. */}
      <Modal visible={manualVisible} animationType="slide" onRequestClose={() => setManualVisible(false)} transparent>
        <View style={styles.manualBackdrop}>
          <Card style={styles.manualCard} testID="manual-entry">
            <Text style={styles.manualTitle} accessibilityRole="header">Enter machine code</Text>
            <TextField
              label="Machine code"
              helper="Printed on the machine label next to the QR code, e.g. CNC-001."
              value={manualCode}
              onChangeText={(text) => {
                setManualCode(text);
                setManualError(null);
              }}
              onSubmitEditing={submitManual}
              placeholder="CNC-001"
              autoCapitalize="none"
              returnKeyType="go"
              autoFocus
              required
              error={manualError ?? undefined}
              accessibilityHint="Type the machine code, then choose Find machine"
              testID="manual-code-input"
            />
            <Button label="Find machine" size="lg" onPress={submitManual} testID="manual-submit" />
            <View style={{ height: spacing.sm }} />
            <Button label="Back to scanner" variant="secondary" onPress={() => setManualVisible(false)} />
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const FRAME = 240;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.bg,
  },
  title: { color: colors.text, fontSize: typeScale.heading, fontWeight: '700', textAlign: 'center' },
  centerText: { color: colors.textMuted, fontSize: typeScale.body, textAlign: 'center', lineHeight: 24 },
  cameraWrap: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  roundButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(15,17,21,0.75)',
    borderColor: colors.borderStrong,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.floating,
  },
  roundButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roundButtonIcon: { color: colors.text, fontSize: iconSize.md },
  frameArea: { alignItems: 'center' },
  frame: {
    width: FRAME,
    height: FRAME,
    borderWidth: 3,
    borderColor: '#ffffff',
    borderRadius: radius.lg,
    backgroundColor: 'transparent',
  },
  instruction: {
    color: '#ffffff',
    fontSize: typeScale.body,
    fontWeight: '600',
    marginTop: spacing.md,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
    textAlign: 'center',
  },
  bottomBar: { padding: spacing.md, gap: spacing.sm },
  problemBox: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.error,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  problemTitle: { color: colors.error, fontSize: typeScale.subheading, fontWeight: '700' },
  problemText: { color: colors.textMuted, fontSize: typeScale.small, lineHeight: 20 },
  resolvingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(15,17,21,0.85)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  resolvingText: { color: colors.text, fontSize: typeScale.body },
  manualButton: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: 'rgba(15,17,21,0.85)',
    borderColor: colors.borderStrong,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  manualButtonText: { color: colors.text, fontSize: typeScale.body, fontWeight: '600' },
  manualBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  manualCard: {
    margin: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.lg,
  },
  manualTitle: { color: colors.text, fontSize: typeScale.heading, fontWeight: '700', marginBottom: spacing.sm },
});
