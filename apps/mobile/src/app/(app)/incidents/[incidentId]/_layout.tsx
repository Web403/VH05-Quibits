import { useTheme, useThemedStyles } from '@/theme/theme';
import { Stack } from 'expo-router';


export default function IncidentDetailLayout(): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
