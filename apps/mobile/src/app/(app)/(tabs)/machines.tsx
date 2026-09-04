/**
 * Machines tab - scan, search and browse authorized machines.
 *
 * Searches the backend `search` filter (machine name, asset tag, serial
 * number) plus machine-model names (matching model → machines). A model chip
 * row filters by model directly; recently accessed machines are one tap
 * away when nothing is searched. Shows only what the API returns for this
 * user: no invented telemetry or status.
 */
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTheme, useThemedStyles } from '@/theme/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/auth-context';
import { useMachines, useMachineModelOptions, useMachineModelSearch, useRecents } from '@/hooks/queries';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Button, TextField } from '@/components/ui';
import { EmptyState, ErrorState, SkeletonList } from '@/components/states';
import { MachineRow } from '@/components/list-rows';
import type { MachineView } from '@/api/types';
import { errorMessage } from '@/api/errors';
import { spacing, type as typeScale } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';

export default function MachinesScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [search, setSearch] = useState('');
  const [modelFilter, setModelFilter] = useState<string | null>(null);
  const debounced = useDebouncedValue(search, 350);

  const machineQuery = useMachines(userId, {
    search: debounced || undefined,
    machineModelId: modelFilter ?? undefined,
  });
  // Model-name search is a second, cheap leg: a model match yields its machines.
  const modelQuery = useMachineModelSearch(userId, debounced);
  const modelOptions = useMachineModelOptions(userId);
  const recents = useRecents(userId, 'machines');
  const [modelIdProbe, setModelIdProbe] = useState<string | null>(null);
  const probeQuery = useMachines(userId, modelIdProbe ? { machineModelId: modelIdProbe } : {});

  useEffect(() => {
    const modelHit = modelQuery.data?.items[0];
    setModelIdProbe(modelHit && debounced.length >= 2 && !modelFilter ? modelHit.id : null);
  }, [modelQuery.data, debounced, modelFilter]);

  const byId = new Map<string, MachineView>();
  for (const machine of machineQuery.data?.pages.flatMap((page) => page.items) ?? []) byId.set(machine.id, machine);
  for (const machine of probeQuery.data?.pages.flatMap((page) => page.items) ?? []) byId.set(machine.id, machine);
  const machines = [...byId.values()];

  const error =
    (machineQuery.isError && !machineQuery.data ? machineQuery.error : null) ??
    (probeQuery.isError && !probeQuery.data ? probeQuery.error : null);

  const showRecents = !search.trim() && !modelFilter && recents.length > 0;
  const modelItems = modelOptions.data?.items ?? [];
  const selectedModelName = modelFilter ? modelItems.find((model) => model.id === modelFilter)?.modelName ?? 'model' : null;

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Machines',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
      <FlatList<MachineView>
        data={machines}
        keyExtractor={(machine) => machine.id}
        contentContainerStyle={styles.content}
        refreshing={machineQuery.isRefetching}
        onRefresh={() => void machineQuery.refetch()}
        onEndReached={() => {
          if (machineQuery.hasNextPage && !machineQuery.isFetchingNextPage) void machineQuery.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={styles.header}>
            <Button
              label="Scan Machine"
              icon="▣"
              size="lg"
              onPress={() => router.push('/(app)/scan')}
              accessibilityHint="Opens the camera to scan a machine QR code"
              testID="machines-scan"
            />
            <TextField
              label="Search"
              value={search}
              onChangeText={setSearch}
              placeholder="Name, code, serial or model…"
              autoCapitalize="none"
              helper="Searches machine names, machine codes and serial numbers."
              testID="machine-search"
              style={{ marginTop: spacing.md }}
            />
            {modelItems.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.modelRow}
                accessibilityLabel="Filter by machine model"
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Show machines of all models"
                  accessibilityState={{ selected: modelFilter === null }}
                  onPress={() => setModelFilter(null)}
                  style={[styles.modelChip, modelFilter === null && styles.modelChipActive]}
                >
                  <Text style={[styles.modelChipText, modelFilter === null && styles.modelChipTextActive]}>All models</Text>
                </Pressable>
                {modelItems.map((model) => {
                  const active = modelFilter === model.id;
                  return (
                    <Pressable
                      key={model.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Filter by model ${model.manufacturer} ${model.modelName}`}
                      accessibilityState={{ selected: active }}
                      onPress={() => setModelFilter(active ? null : model.id)}
                      style={[styles.modelChip, active && styles.modelChipActive]}
                    >
                      <Text style={[styles.modelChipText, active && styles.modelChipTextActive]} numberOfLines={1}>
                        {model.modelName}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
            {selectedModelName ? (
              <Text style={styles.modelNote}>Showing {selectedModelName} machines only.</Text>
            ) : modelIdProbe ? (
              <Text style={styles.modelNote}>Including machines of matching model.</Text>
            ) : null}
            {showRecents ? (
              <View style={styles.recentSection}>
                <Text style={styles.recentLabel}>Recently accessed</Text>
                <View style={styles.recentRow}>
                  {recents.slice(0, 4).map((recent) => (
                    <Pressable
                      key={recent.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Open recent machine ${recent.label}`}
                      onPress={() => router.push(`/(app)/machines/${recent.id}`)}
                      style={styles.recentChip}
                      testID={`machines-recent-${recent.id}`}
                    >
                      <Text style={styles.recentChipText} numberOfLines={1}>↺ {recent.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <MachineRow machine={item} onPress={() => router.push(`/(app)/machines/${item.id}`)} />
        )}
        ListEmptyComponent={
          machineQuery.isInitialLoading ? (
            <SkeletonList rows={6} />
          ) : error ? (
            <ErrorState message={errorMessage(error)} onRetry={() => void machineQuery.refetch()} />
          ) : (
            <EmptyState
              title="No machines found"
              message={
                search || modelFilter
                  ? 'No machine or model matches. Try scanning the QR code on the machine instead.'
                  : 'No machines are authorized for your account yet.'
              }
              actionLabel={search || modelFilter ? undefined : 'Scan Machine'}
              onAction={search || modelFilter ? undefined : () => router.push('/(app)/scan')}
            />
          )
        }
        ListFooterComponent={
          machineQuery.isFetchingNextPage ? <Text style={styles.footer}>Loading more…</Text> : null
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  header: { marginBottom: spacing.sm },
  modelRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  modelChip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    maxWidth: 200,
  },
  modelChipActive: { backgroundColor: colors.primaryBg, borderColor: colors.primary },
  modelChipText: { color: colors.textMuted, fontSize: typeScale.small, fontWeight: '600' },
  modelChipTextActive: { color: colors.primary },
  modelNote: { color: colors.textSubtle, fontSize: typeScale.tiny, marginTop: spacing.xs, marginBottom: spacing.sm },
  recentSection: { marginTop: spacing.sm, marginBottom: spacing.xs },
  recentLabel: { color: colors.textMuted, fontSize: typeScale.small, marginBottom: spacing.xs },
  recentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  recentChip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    maxWidth: 240,
  },
  recentChipText: { color: colors.text, fontSize: typeScale.small },
  footer: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
});
