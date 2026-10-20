import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space, useTheme } from './theme';

export function Button({
  label, onPress, variant = 'primary', disabled, style,
}: {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; style?: ViewStyle;
}) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.primary : variant === 'danger' ? 'transparent' : t.surfaceAlt;
  const fg = variant === 'primary' ? t.onPrimary : variant === 'danger' ? t.danger : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }, style]}
    >
      <Text style={[s.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={[s.label, { color: t.muted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={t.muted}
        {...props}
        style={[
          s.input,
          { backgroundColor: t.surface, borderColor: t.border, color: t.text },
          props.multiline ? { minHeight: 110, textAlignVertical: 'top' } : null,
        ]}
      />
    </View>
  );
}

export function Panel({ children, style, onPress }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const t = useTheme();
  const base = [s.panel, { backgroundColor: t.surface, borderColor: t.border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...base, pressed ? { opacity: 0.85 } : null]}>
      {children}
    </Pressable>
  );
}

export function Empty({ icon, title, hint }: { icon: keyof typeof Ionicons.glyphMap; title: string; hint: string }) {
  const t = useTheme();
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={44} color={t.muted} />
      <Text style={[s.emptyTitle, { color: t.text }]}>{title}</Text>
      <Text style={{ color: t.muted, textAlign: 'center' }}>{hint}</Text>
    </View>
  );
}

export function Fab({ onPress, label }: { onPress: () => void; label: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.fab, { backgroundColor: t.primary, opacity: pressed ? 0.85 : 1 }]}
    >
      <Ionicons name="add" size={28} color={t.onPrimary} />
    </Pressable>
  );
}

export function Stat({ value, label }: { value: string | number; label: string }) {
  const t = useTheme();
  return (
    <Panel style={{ flex: 1, alignItems: 'center', paddingVertical: space.md }}>
      <Text style={{ fontSize: 28, fontWeight: '700', color: t.text }}>{value}</Text>
      <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>{label}</Text>
    </Panel>
  );
}

const s = StyleSheet.create({
  btn: { paddingVertical: 14, paddingHorizontal: space.lg, borderRadius: radius.md, alignItems: 'center' },
  btnText: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: radius.md, padding: 12, fontSize: 16 },
  panel: { borderWidth: 1, borderRadius: radius.md, padding: space.md },
  empty: { alignItems: 'center', padding: space.xl, gap: space.sm, marginTop: space.xl },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  fab: {
    position: 'absolute', right: space.md, bottom: space.lg, width: 58, height: 58, borderRadius: 29,
    alignItems: 'center', justifyContent: 'center', elevation: 4,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
});
