/**
 * Incident creation.
 *
 * Field-friendly: machine picker with recent machines, symptom chips with
 * suggestions, severity/priority buttons, date-time picker. Validation is
 * client-side (mirrors the backend validators); the backend remains the final
 * authority. Submission always goes through the outbox, so it also works
 * offline - the result is clearly communicated (queued vs saved).
 *
 * Machine handling:
 *  - Opened from a machine (detail screen or QR scan), the machine is
 *    PRESELECTED and shown prominently; changing it requires an explicit
 *    confirmation so a scan can never be silently swapped by a stray tap.
 *  - The selected machine (and model) is preserved in the server request.
 *
 * Interruptions: the form autosaves a local draft while dirty and offers to
 * restore it on return; leaving with unsaved edits asks first. Drafts are a
 * convenience only - they are deleted on submit and never masquerade as a
 * server record.
 */
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useTheme, useThemedStyles } from '@/theme/theme';
import { useAuth } from '@/auth/auth-context';
import { createIncidentSchema, type CreateIncidentValues } from '@/validation/schemas';
import { useMachine, useQueuedWrite, useRecents } from '@/hooks/queries';
import { Button, Card, ChoiceGroup, SectionTitle, TextField } from '@/components/ui';
import { DateTimeField, MachinePicker, TagListInput } from '@/components/forms';
import { ConfirmDialog } from '@/components/banners';
import { InlineBanner, LoadingState } from '@/components/states';
import type { MachineView } from '@/api/types';
import { PRIORITIES, SEVERITIES } from '@itp/shared';
import { severity as severityPresentation, priority as priorityPresentation } from '@/lib/labels';
import { clearIncidentDraft, draftHasContent, loadIncidentDraft, saveIncidentDraft, type IncidentDraft } from '@/lib/drafts';
import { errorMessage } from '@/api/errors';
import { spacing, type as typeScale } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';

const SYMPTOM_SUGGESTIONS = [
  'unusual noise',
  'vibration',
  'overheating',
  'leak',
  'error code on HMI',
  "won't start",
  'stops mid-cycle',
  'low pressure',
];

export default function CreateIncidentScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{ machineId?: string }>();
  const preselectedMachineId = typeof params.machineId === 'string' ? params.machineId : '';
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queued = useQueuedWrite(userId);
  const recents = useRecents(userId, 'machines');
  // Preselected machine (from machine detail "Report incident" / QR scan).
  const preselectedQuery = useMachine(userId, preselectedMachineId);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [changeConfirmVisible, setChangeConfirmVisible] = useState(false);
  const [machine, setMachine] = useState<MachineView | null>(null);
  const [resultNote, setResultNote] = useState<string | null>(null);
  const [draft, setDraft] = useState<IncidentDraft | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const navigation = useNavigation();

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CreateIncidentValues>({
    resolver: zodResolver(createIncidentSchema),
    defaultValues: {
      title: '',
      description: '',
      severity: 'medium',
      priority: 'medium',
      symptoms: [],
      errorCodes: [],
      operatingConditions: [],
      tags: [],
    },
  });

  // Resolve the preselected machine once it loads.
  useEffect(() => {
    const resolved = preselectedQuery.data?.data;
    if (resolved && !machine) setMachine(resolved);
  }, [preselectedQuery.data, machine]);

  // Offer a draft only when there was no explicit machine chosen up-front.
  useEffect(() => {
    if (!userId || preselectedMachineId) return;
    const stored = loadIncidentDraft(userId);
    if (draftHasContent(stored)) setDraft(stored);
  }, [userId, preselectedMachineId]);

  // Autosave the draft while the form has content (local kv, no server call).
  useEffect(() => {
    const subscription = watch((values) => {
      if (submitted || !userId) return;
      saveIncidentDraft(userId, {
        machineId: machine?.id ?? null,
        machineLabel: machine ? machine.displayName ?? machine.assetTag : null,
        title: values.title ?? '',
        description: values.description ?? '',
        severity: values.severity ?? 'medium',
        priority: values.priority ?? 'medium',
        symptoms: values.symptoms ?? [],
        errorCodes: values.errorCodes ?? [],
        operatingConditions: values.operatingConditions ?? [],
        tags: values.tags ?? [],
      });
    });
    return () => subscription.unsubscribe();
  }, [watch, machine, userId, submitted]);

  // Unsaved-changes guard: leaving with meaningful edits asks first.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (submitted || (!isDirty && !machine)) return;
      event.preventDefault();
      Alert.alert(
        'Discard this report?',
        'Your report is not submitted yet. It is saved as a draft on this device and you can finish it later - or discard it now.',
        [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Leave (keep draft)',
            onPress: () => navigation.dispatch(event.data.action),
          },
          {
            text: 'Discard report',
            style: 'destructive',
            onPress: () => {
              clearIncidentDraft(userId);
              navigation.dispatch(event.data.action);
            },
          },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, isDirty, machine, submitted, userId]);

  const restoreDraft = () => {
    if (!draft) return;
    reset({
      title: draft.title,
      description: draft.description,
      severity: draft.severity as CreateIncidentValues['severity'],
      priority: draft.priority as CreateIncidentValues['priority'],
      symptoms: draft.symptoms,
      errorCodes: draft.errorCodes,
      operatingConditions: draft.operatingConditions,
      tags: draft.tags,
    });
    // Restore the machine as well (same partial view the recents list uses -
    // the live record is re-fetched on demand elsewhere).
    if (draft.machineId && !machine) {
      setMachine({
        id: draft.machineId,
        assetTag: draft.machineLabel ?? draft.machineId,
        machineModelId: '',
      } as MachineView);
    }
    setDraft(null);
  };

  const discardDraft = () => {
    clearIncidentDraft(userId);
    setDraft(null);
  };

  const onChangeMachinePress = () => {
    if (preselectedMachineId && machine) {
      // A scanned/linked machine can only be replaced deliberately.
      setChangeConfirmVisible(true);
    } else {
      setPickerVisible(true);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!machine) return;
    setResultNote(null);
    setSubmitted(true);
    const result = await queued.mutateAsync({
      type: 'create_incident',
      payload: {
        title: values.title,
        description: values.description,
        machineId: machine.id,
        ...(machine.machineModelId ? { machineModelId: machine.machineModelId } : {}),
        severity: values.severity,
        priority: values.priority,
        symptoms: values.symptoms,
        errorCodes: values.errorCodes,
        operatingConditions: values.operatingConditions,
        tags: values.tags,
        firstObservedAt: values.firstObservedAt,
        source: 'other',
        ...(values.conversationId ? { conversationId: values.conversationId } : {}),
        ...(values.manualId ? { manualId: values.manualId, manualVersion: values.manualVersion } : {}),
      },
    });
    if (result.kind === 'completed') {
      clearIncidentDraft(userId);
      const incidentId = result.op.serverResult?.incidentId;
      router.replace(incidentId ? `/(app)/incidents/${incidentId}` : '/(app)/(tabs)/work');
      return;
    }
    setSubmitted(false);
    if (result.kind === 'queued') {
      clearIncidentDraft(userId);
      setResultNote('Saved on this device. It will sync automatically when you have a connection.');
    } else if (result.kind === 'failed') {
      setResultNote(`The server rejected this report: ${result.op.lastError ?? 'validation failed'}`);
    } else {
      setResultNote('The server did not confirm this report. Open Profile → Queued changes to review it.');
    }
  });

  const waitingForPreselect = Boolean(preselectedMachineId) && !machine && preselectedQuery.isLoading;

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Report incident',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {resultNote ? <InlineBanner tone="warn">{resultNote}</InlineBanner> : null}
          {draft ? (
            <Card>
              <Text style={styles.draftTitle}>Unfinished report found</Text>
              <Text style={styles.draftText}>
                You started a report{draft.machineLabel ? ` for ${draft.machineLabel}` : ''}. It is only a draft on
                this device, not a submitted incident.
              </Text>
              <View style={styles.draftActions}>
                <Button label="Restore draft" variant="secondary" onPress={restoreDraft} testID="draft-restore" />
                <Button label="Discard draft" variant="ghost" onPress={discardDraft} />
              </View>
            </Card>
          ) : null}

          <SectionTitle>Machine</SectionTitle>
          <Card testID="incident-machine-card">
            {waitingForPreselect ? (
              <LoadingState label="Loading the machine…" />
            ) : machine ? (
              <View>
                <Text style={styles.machineName}>{machine.displayName ?? machine.assetTag}</Text>
                <Text style={styles.machineSub}>
                  {machine.assetTag}
                  {machine.serialNumber ? ` · SN ${machine.serialNumber}` : ''}
                  {machine.modelSnapshot ? ` · ${machine.modelSnapshot.modelName}` : ''}
                </Text>
                {preselectedMachineId ? (
                  <Text style={styles.machineLockNote}>Selected from the machine screen — verify this is the machine you are working on.</Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.machineSub}>Select the physical machine this incident is about.</Text>
            )}
            {preselectedQuery.isError ? (
              <Text style={styles.error}>Could not load the linked machine. Check your connection, or pick the machine manually.</Text>
            ) : null}
            {!waitingForPreselect ? (
              <>
                <View style={{ height: spacing.sm }} />
                <Button
                  label={machine ? 'Change machine' : 'Select machine'}
                  variant="secondary"
                  onPress={onChangeMachinePress}
                  testID="incident-machine-picker"
                />
              </>
            ) : null}
            {recents.length > 0 && !machine && !preselectedMachineId ? (
              <View style={styles.recentWrap}>
                {recents.slice(0, 4).map((recent) => (
                  <Button
                    key={recent.id}
                    label={recent.label}
                    icon="↺"
                    variant="ghost"
                    onPress={() => setMachine({ id: recent.id, assetTag: recent.label, machineModelId: '' } as MachineView)}
                  />
                ))}
              </View>
            ) : null}
            {errors.machineId ? <Text style={styles.error}>{errors.machineId.message}</Text> : null}
          </Card>

          <Controller
            control={control}
            name="title"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="Title"
                required
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.title?.message}
                testID="incident-title"
              />
            )}
          />
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="What happened?"
                required
                helper="Facts only: what you saw, heard or measured. Suggestions come later."
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                multiline
                error={errors.description?.message}
                testID="incident-description"
              />
            )}
          />

          <Controller
            control={control}
            name="severity"
            render={({ field: { onChange, value } }) => (
              <ChoiceGroup
                label="Severity"
                options={SEVERITIES.map((value) => ({
                  value,
                  label: severityPresentation(value).label,
                  icon: severityPresentation(value).icon,
                  tone: severityPresentation(value).tone,
                }))}
                value={value}
                onChange={onChange}
                testID="incident-severity"
              />
            )}
          />
          <Controller
            control={control}
            name="priority"
            render={({ field: { onChange, value } }) => (
              <ChoiceGroup
                label="Priority"
                options={PRIORITIES.map((value) => ({
                  value,
                  label: priorityPresentation(value).label,
                  icon: priorityPresentation(value).icon,
                  tone: priorityPresentation(value).tone,
                }))}
                value={value}
                onChange={onChange}
              />
            )}
          />

          <Controller
            control={control}
            name="symptoms"
            render={({ field: { onChange, value } }) => (
              <TagListInput
                label="Symptoms"
                values={value}
                onChange={onChange}
                placeholder="e.g. grinding noise from spindle"
                suggestions={SYMPTOM_SUGGESTIONS}
                testID="incident-symptoms"
              />
            )}
          />
          <Controller
            control={control}
            name="errorCodes"
            render={({ field: { onChange, value } }) => (
              <TagListInput label="Error codes" values={value} onChange={onChange} placeholder="e.g. E-104" testID="incident-error-codes" />
            )}
          />
          <Controller
            control={control}
            name="operatingConditions"
            render={({ field: { onChange, value } }) => (
              <TagListInput
                label="Operating conditions"
                values={value}
                onChange={onChange}
                placeholder="e.g. high load, cold start"
              />
            )}
          />
          <Controller
            control={control}
            name="tags"
            render={({ field: { onChange, value } }) => (
              <TagListInput label="Tags" values={value} onChange={onChange} placeholder="e.g. hydraulics" maxItems={20} />
            )}
          />
          <Controller
            control={control}
            name="firstObservedAt"
            render={({ field: { onChange, value } }) => (
              <DateTimeField label="First observed" value={value} onChange={onChange} />
            )}
          />

          <Button
            label="Report incident"
            size="lg"
            onPress={() => void onSubmit()}
            loading={isSubmitting || queued.isPending}
            testID="incident-submit"
          />
          <Text style={styles.hint}>
            Works offline: if there is no connection the report is saved on this
            device and synced later. Nothing is marked as “reported” until the
            server confirms it.
          </Text>
          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
      <MachinePicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={setMachine}
      />
      <ConfirmDialog
        visible={changeConfirmVisible}
        title="Change machine?"
        message={`This report is for ${machine?.displayName ?? machine?.assetTag ?? 'the scanned machine'}. Only replace it if you are reporting a problem on a different machine.`}
        confirmLabel="Change machine"
        cancelLabel="Keep this machine"
        onCancel={() => setChangeConfirmVisible(false)}
        onConfirm={() => {
          setChangeConfirmVisible(false);
          setPickerVisible(true);
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  machineName: { color: colors.text, fontSize: typeScale.body, fontWeight: '700' },
  machineSub: { color: colors.textMuted, fontSize: typeScale.small, marginTop: 2 },
  machineLockNote: { color: colors.warn, fontSize: typeScale.tiny, marginTop: spacing.xs },
  recentWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  error: { color: colors.error, fontSize: typeScale.small, marginTop: spacing.xs },
  draftTitle: { color: colors.text, fontSize: typeScale.body, fontWeight: '700' },
  draftText: { color: colors.textMuted, fontSize: typeScale.small, marginTop: 2, marginBottom: spacing.sm },
  draftActions: { flexDirection: 'row', gap: spacing.sm },
  hint: { color: colors.textSubtle, fontSize: typeScale.tiny, marginTop: spacing.md, textAlign: 'center' },
});
