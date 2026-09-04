/**
 * Home - the field dashboard.
 *
 * Field actions come first (scan a machine, search, report, your queue,
 * assistant), then the technician's own work: assigned counts, recent
 * incidents, recently opened machines and pending offline changes.
 * No analytics, no admin dashboards.
 */
import { ScrollView, StyleSheet, View, Text, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTheme, useThemedStyles } from '@/theme/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/auth-context';
import { useHomeOverview, useRecents, useSyncStatus } from '@/hooks/queries';
import { useNetwork } from '@/hooks/use-network';
import { useSyncEngine } from '@/hooks/use-sync';
import { Button, Card, SectionTitle, StatTile, Badge } from '@/components/ui';
import { PressableRow, EmptyState, ErrorState, LoadingState, SkeletonList } from '@/components/states';
import { IncidentRow } from '@/components/list-rows';
import { HOME_ACTIONS } from '@/lib/home-actions';
import { relativeTime } from '@/lib/format';
import { errorMessage } from '@/api/errors';
import { spacing, type as typeScale } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';

const PRIMARY_ACTION = HOME_ACTIONS.find((action) => action.primary)!;
const SECONDARY_ACTIONS = HOME_ACTIONS.filter((action) => !action.primary);

export default function HomeScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const userId = user?.id ?? '';
  const overview = useHomeOverview(userId);
  const sync = useSyncStatus(userId, false);
  const recentMachines = useRecents(userId, 'machines');
  const { syncNow } = useSyncEngine(userId);
  const [refreshing, setRefreshing] = useState(false);

  const data = overview.data?.data;
  const firstName = (user?.fullName ?? 'there').split(' ')[0];

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await overview.refetch();
      await sync.refetch();
      await syncNow();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Hi, {firstName}</Text>
            <Text style={styles.role} numberOfLines={1}>
              {user?.fullName} · {user?.role}
            </Text>
          </View>
          {!isOnline ? <Badge icon="⊘" label="Offline" tone="warn" /> : null}
        </View>

        {/* The single most common field action, unmissable and one-handed. */}
        <Button
          label={PRIMARY_ACTION.label}
          icon={PRIMARY_ACTION.icon}
          size="lg"
          onPress={() => router.push(PRIMARY_ACTION.route as never)}
          accessibilityHint={PRIMARY_ACTION.accessibilityHint}
          testID={PRIMARY_ACTION.testID}
          style={styles.scanButton}
        />
        <Text style={styles.scanHint}>Point the camera at the QR code on the machine.</Text>

        <View style={styles.quickGrid}>
          {SECONDARY_ACTIONS.map((action) => (
            <Button
              key={action.label}
              label={action.label}
              icon={action.icon}
              variant="secondary"
              onPress={() => router.push(action.route as never)}
              accessibilityHint={action.accessibilityHint}
              testID={action.testID}
              style={styles.quickButton}
            />
          ))}
        </View>

        <SectionTitle>Your work</SectionTitle>
        {overview.isInitialLoading ? (
          <SkeletonList rows={2} />
        ) : overview.isError && !data ? (
          <ErrorState message={errorMessage(overview.error)} onRetry={() => void overview.refetch()} />
        ) : (
          <View style={styles.statGrid}>
            <StatTile label="Assigned open" count={data?.assignedOpen ?? null} tone="warn" onPress={() => router.push('/(app)/(tabs)/work')} testID="home-open" />
            <StatTile label="Investigating" count={data?.investigating ?? null} tone="info" onPress={() => router.push('/(app)/(tabs)/work')} />
          </View>
        )}
        {overview.isError && data ? (
          <Text style={styles.staleNote}>Offline — counts are a saved copy.</Text>
        ) : null}
        {!overview.isError ? (
          <View style={styles.statGrid}>
            <StatTile label="Waiting for info" count={data?.waitingInfo ?? null} tone="neutral" onPress={() => router.push('/(app)/(tabs)/work')} />
            <StatTile label="Unresolved issues" count={data?.unresolvedIssues ?? null} tone="error" onPress={() => router.push('/(app)/(tabs)/work')} />
          </View>
        ) : null}

        <SectionTitle>Pending offline changes</SectionTitle>
        <Card>
          <Text style={styles.syncLine}>
            {(sync.data?.pending ?? 0) + (sync.data?.review ?? 0) === 0
              ? 'Everything is synced.'
              : `${sync.data?.pending ?? 0} pending · ${sync.data?.review ?? 0} need review · ${sync.data?.failed ?? 0} failed`}
          </Text>
          <Text style={styles.syncTime}>Last sync: {relativeTime(sync.data?.lastSyncAt)}</Text>
          <View style={styles.syncActions}>
            <Button label="Sync now" variant="secondary" onPress={() => void syncNow()} loading={!isOnline ? false : undefined} disabled={!isOnline} />
            <Button label="Details" variant="ghost" onPress={() => router.push('/(app)/(tabs)/profile')} />
          </View>
        </Card>

        <SectionTitle>Recently created incidents</SectionTitle>
        {overview.isInitialLoading ? (
          <LoadingState label="Loading incidents…" />
        ) : data && data.recentIncidents.length > 0 ? (
          data.recentIncidents.map((incident) => (
            <IncidentRow
              key={incident.id}
              incident={incident}
              onPress={() => router.push(`/(app)/incidents/${incident.id}`)}
            />
          ))
        ) : (
          <EmptyState title="No recent incidents" message="Newly reported incidents across your organization will appear here." />
        )}

        {recentMachines.length > 0 ? (
          <>
            <SectionTitle>Recently opened machines</SectionTitle>
            {recentMachines.map((machine) => (
              <PressableRow
                key={machine.id}
                onPress={() => router.push(`/(app)/machines/${machine.id}`)}
                accessibilityLabel={`Open machine ${machine.label}`}
              >
                <View style={styles.recentRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{machine.label}</Text>
                    {machine.subtitle ? <Text style={styles.rowSub}>{machine.subtitle}</Text> : null}
                  </View>
                  <Badge icon="⚙" label="Machine" tone="neutral" size="sm" testID={`recent-machine-${machine.id}`} />
                </View>
              </PressableRow>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  greeting: { color: colors.text, fontSize: typeScale.title, fontWeight: '800' },
  role: { color: colors.textMuted, fontSize: typeScale.small, marginTop: 2 },
  statGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  quickButton: { flexGrow: 1, minWidth: '46%' },
  scanButton: { marginTop: spacing.xs, minHeight: 64 },
  scanHint: { color: colors.textSubtle, fontSize: typeScale.tiny, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.md },
  syncLine: { color: colors.text, fontSize: typeScale.body, fontWeight: '600' },
  syncTime: { color: colors.textMuted, fontSize: typeScale.small, marginTop: 2, marginBottom: spacing.sm },
  syncActions: { flexDirection: 'row', gap: spacing.sm },
  staleNote: { color: colors.warn, fontSize: typeScale.tiny, marginBottom: spacing.sm },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowTitle: { color: colors.text, fontSize: typeScale.body, fontWeight: '600' },
  rowSub: { color: colors.textMuted, fontSize: typeScale.small },
});
