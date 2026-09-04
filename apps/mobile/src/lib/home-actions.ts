/**
 * Home screen field actions, defined as data so the layout and the tests
 * share one source of truth.
 *
 * Ordering is deliberate and reflects the technician's day:
 *   1. Scan Machine     - the primary action: you are standing AT a machine.
 *   2. Search Machine   - fallback when the QR label is damaged.
 *   3. Create Incident  - report what you found.
 *   4. My Work          - your queue.
 *   5. Ask Assistant    - troubleshooting help.
 *
 * `primary` marks the single visually dominant action. Exactly one exists.
 */
export interface HomeAction {
  label: string;
  icon: string;
  route: string;
  primary: boolean;
  accessibilityHint: string;
  testID: string;
}

export const HOME_ACTIONS: readonly HomeAction[] = [
  {
    label: 'Scan Machine',
    icon: '▣',
    route: '/(app)/scan',
    primary: true,
    accessibilityHint: 'Opens the camera to scan a machine QR code',
    testID: 'home-action-scan',
  },
  {
    label: 'Search Machine',
    icon: '⌕',
    route: '/(app)/(tabs)/machines',
    primary: false,
    accessibilityHint: 'Opens machine search by name, code or serial number',
    testID: 'home-action-search',
  },
  {
    label: 'Create Incident',
    icon: '✚',
    route: '/(app)/incidents/create',
    primary: false,
    accessibilityHint: 'Reports a new incident',
    testID: 'home-action-create',
  },
  {
    label: 'My Work',
    icon: '☑',
    route: '/(app)/(tabs)/work',
    primary: false,
    accessibilityHint: 'Opens your incident queue',
    testID: 'home-action-work',
  },
  {
    label: 'Ask Assistant',
    icon: '✦',
    route: '/(app)/(tabs)/assistant',
    primary: false,
    accessibilityHint: 'Opens the troubleshooting assistant',
    testID: 'home-action-assistant',
  },
] as const;
