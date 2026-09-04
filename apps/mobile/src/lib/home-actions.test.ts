/**
 * Home screen actions: the field workflow as data.
 */
import { HOME_ACTIONS } from './home-actions';

describe('HOME_ACTIONS', () => {
  it('has exactly one primary action: Scan Machine', () => {
    const primaries = HOME_ACTIONS.filter((action) => action.primary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0]?.label).toBe('Scan Machine');
    expect(primaries[0]?.route).toBe('/(app)/scan');
  });

  it('contains the five prioritized field actions', () => {
    const labels = HOME_ACTIONS.map((action) => action.label);
    for (const label of ['Scan Machine', 'Search Machine', 'Create Incident', 'My Work', 'Ask Assistant']) {
      expect(labels).toContain(label);
    }
  });

  it('every action has a route, hint and unique testID', () => {
    const ids = new Set<string>();
    for (const action of HOME_ACTIONS) {
      expect(action.route.length).toBeGreaterThan(0);
      expect(action.accessibilityHint.length).toBeGreaterThan(0);
      expect(ids.has(action.testID)).toBe(false);
      ids.add(action.testID);
    }
  });
});
