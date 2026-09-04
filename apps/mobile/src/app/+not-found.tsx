import { useTheme, useThemedStyles } from '@/theme/theme';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/ui';
import { spacing, type as typeScale } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';

export default function NotFound(): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Page not found</Text>
      <Text style={styles.text}>This screen does not exist, or you no longer have access to it.</Text>
      <Button label="Go to Home" onPress={() => router.replace('/(app)/(tabs)/home')} />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  title: { color: colors.text, fontSize: typeScale.title, fontWeight: '700' },
  text: { color: colors.textMuted, textAlign: 'center' },
});
