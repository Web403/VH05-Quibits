/**
 * Machine detail.
 *
 * The identity block comes first and is deliberately oversized: technicians
 * must be able to confirm they are working on the right equipment before
 * doing anything else. Facts only - exactly what the backend supplies:
 * identity, model snapshot, location, criticality, backend-reported status
 * and open-incident count. No telemetry, no invented values.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { useTheme, useThemedStyles } from '@/theme/theme';
import type { IncidentView } from '@itp/shared';
import { useAuth } from '@/auth/auth-context';
import { useIncidents, useMachine, markMachineVisited } from '@/hooks/queries';
import { Badge, Button, Card, KeyValue, SectionTitle } from '@/components/ui';
import { CachedNotice, EmptyState, ErrorState, LoadingState } from '@/components/states';
import { IncidentRow } from '@/components/list-rows';
import { machineStatus } from '@/lib/labels';
import { locationLabel, formatDate } from '@/lib/format';
import { errorMessage } from '@/api/errors';
import { spacing, type as typeScale } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';

export default function MachineDetailScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { machineId } = useLocalSearchParams<{ machineId: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const query = useMachine(userId, machineId);
  const machine = query.data?.data;
  const recentIncidents = useIncidents(userId, { machineId, assignedToMe: false });

  useEffect(() => {
    if (machine) markMachineVisited(userId, machine);
  }, [machine, userId]);

  const incidents: IncidentView[] = recentIncidents.data?.pages[0]?.items ?? [];
  const modelName = machine?.modelSnapshot
    ? `${machine.modelSnapshot.manufacturer} ${machine.modelSnapshot.modelName}`
    : null;

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: machine?.displayName ?? machine?.assetTag ?? 'Machine',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {query.isInitialLoading ? (
          <LoadingState label="Loading machine…" />
        ) : query.isError || !machine ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : (
          <>
            {query.data?.cached ? <CachedNotice age="recent" /> : null}

            {/* Identity block - confirm you are at the right machine. */}
            <Card style={styles.identityCard} testID="machine-identity">
              <Text style={styles.identityName} accessibilityRole="header">
                {machine.displayName ?? machine.assetTag}
              </Text>
              {machine.displayName ? <Text style={styles.identityCode}>{machine.assetTag}</Text> : null}
              <View style={styles.badgeRow}>
                <Badge {...machineStatus(machine.status)} />
                {machine.criticality ? (
                  <Badge
                    icon={machine.criticality === 'critical' ? '⯅' : '◇'}
                    label={`${machine.criticality} criticality`}
                    tone={machine.criticality === 'critical' ? 'error' : 'neutral'}
                  />
                ) : null}
                {machine.openIncidentCount > 0 ? (
                  <Badge icon="!" label={`${machine.openIncidentCount} open`} tone="warn" />
                ) : null}
              </View>
              <View style={styles.identityFacts}>
                {machine.serialNumber ? (
                  <Text style={styles.identityFact}>SN {machine.serialNumber}</Text>
                ) : null}
                {modelName ? <Text style={styles.identityFact}>{modelName}</Text> : null}
                {locationLabel(machine.location) ? (
                  <Text style={styles.identityFact}>{locationLabel(machine.location)}</Text>
                ) : null}
              </View>
            </Card>

            <View style={styles.actionGrid}>
              <Button
                label="Ask Assistant"
                icon="✦"
                onPress={() => router.push(`/(app)/machines/${machine.id}/assistant`)}
                accessibilityHint={`Opens the troubleshooting assistant for ${machine.displayName ?? machine.assetTag}`}
                style={styles.actionButton}
                testID="machine-ask"
              />
              <Button
                label="Report incident"
                icon="✚"
                variant="secondary"
                onPress={() => router.push({ pathname: '/(app)/incidents/create', params: { machineId: machine.id } })}
                accessibilityHint="Reports a new incident for this machine"
                style={styles.actionButton}
                testID="machine-report"
              />
              <Button
                label="Manuals"
                icon="▤"
                variant="secondary"
                onPress={() => router.push(`/(app)/machines/${machine.id}/manuals`)}
                style={styles.actionButton}
              />
              <Button
                label="Open incidents"
                icon="☷"
                variant="secondary"
                onPress={() => router.push(`/(app)/machines/${machine.id}/incidents`)}
                style={styles.actionButton}
              />
              <Button
                label="Scan another machine"
                icon="▣"
                variant="ghost"
                onPress={() => router.push('/(app)/scan')}
                accessibilityHint="Opens the camera to scan a different machine QR code"
                style={styles.actionButton}
                testID="machine-scan-again"
              />
            </View>

            <SectionTitle>Details</SectionTitle>
            <Card>
              <KeyValue label="Machine code" value={machine.assetTag} />
              <KeyValue label="Serial number" value={machine.serialNumber ?? '—'} />
              <KeyValue label="Model" value={modelName ?? machine.machineModelId} />
              {machine.modelSnapshot ? <KeyValue label="Type" value={machine.modelSnapshot.machineType.replace(/_/g, ' ')} /> : null}
              <KeyValue label="Location" value={locationLabel(machine.location) || '—'} />
              <KeyValue label="Installed" value={formatDate(machine.installedAt)} />
              <KeyValue label="Last maintenance" value={formatDate(machine.lastMaintenanceAt)} />
              {machine.notes ? (
                <>
                  <View style={{ height: spacing.sm }} />
                  <Text style={styles.notes}>{machine.notes}</Text>
                </>
              ) : null}
            </Card>

            <SectionTitle>Recent incidents</SectionTitle>
            {recentIncidents.isInitialLoading ? (
              <LoadingState label="Loading incidents…" />
            ) : incidents.length > 0 ? (
              incidents.map((incident) => (
                <IncidentRow key={incident.id} incident={incident} onPress={() => router.push(`/(app)/incidents/${incident.id}`)} />
              ))
            ) : (
              <EmptyState title="No incidents on record" message="Historical incidents for this machine appear here." />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  identityCard: { borderColor: colors.borderStrong },
  identityName: { color: colors.text, fontSize: typeScale.title, fontWeight: '800' },
  identityCode: { color: colors.primary, fontSize: typeScale.subheading, fontWeight: '700', marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  identityFacts: { marginTop: spacing.sm, gap: 2 },
  identityFact: { color: colors.textMuted, fontSize: typeScale.body },
  notes: { color: colors.textMuted, fontSize: typeScale.small, lineHeight: 20 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  actionButton: { flexGrow: 1, minWidth: '46%' },
});
