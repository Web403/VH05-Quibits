import { useTheme, useThemedStyles } from '@/theme/theme';
/**
 * Machine confirmation sheet.
 *
 * Shown after a successful QR scan BEFORE anything else happens. The machine
 * identity (name, machine code, model, serial number) is rendered large so
 * the technician can compare it against the physical machine: QR scanning
 * proves you are AT a machine, and this sheet is where you confirm it is the
 * RIGHT one. Nothing is created or mutated here.
 */
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MachineQrSummary } from '@/api/types';
import { Button, KeyValue, Badge } from './ui';
import { machineStatus } from '@/lib/labels';
import { locationLabel } from '@/lib/format';
import { elevation, radius, spacing, type as typeScale } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';

export function MachineConfirmSheet({
  machine,
  onOpen,
  onScanAgain,
  testID,
}: {
  machine: MachineQrSummary;
  onOpen: () => void;
  onScanAgain: () => void;
  testID?: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const status = machineStatus(machine.status);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onScanAgain}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal testID={testID}>
          <Text style={styles.kicker}>Is this your machine?</Text>
          <Text style={styles.name} accessibilityRole="header">
            {machine.name}
          </Text>
          <View style={styles.badgeRow}>
            <Badge {...status} size="sm" />
            {machine.openIncidentCount > 0 ? (
              <Badge icon="!" label={`${machine.openIncidentCount} open`} tone="warn" size="sm" />
            ) : null}
          </View>

          <View style={styles.facts}>
            <KeyValue label="Machine code" value={machine.machineCode} />
            <KeyValue label="Serial number" value={machine.serialNumber ?? '—'} />
            <KeyValue label="Model" value={machine.machineModelName ?? '—'} />
            <KeyValue label="Location" value={locationLabel(machine.location) || '—'} />
          </View>

          <Button
            label="Open this machine"
            icon="→"
            size="lg"
            onPress={onOpen}
            accessibilityHint="Opens the details, incidents, manuals and assistant for this machine"
            testID={testID ? `${testID}-open` : undefined}
          />
          <View style={{ height: spacing.sm }} />
          <Button
            label="Not this machine — scan again"
            variant="secondary"
            onPress={onScanAgain}
            accessibilityHint="Returns to the camera to scan a different QR code"
            testID={testID ? `${testID}-rescan` : undefined}
          />
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    ...elevation.raised,
  },
  kicker: {
    color: colors.primary,
    fontSize: typeScale.small,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  name: {
    color: colors.text,
    fontSize: typeScale.title,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  facts: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
});
