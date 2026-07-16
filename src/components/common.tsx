import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { theme, fontSizes } from '../theme';

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        kind === 'primary' && { backgroundColor: theme.accent },
        kind === 'secondary' && {
          backgroundColor: theme.surfaceHi,
          borderWidth: 1,
          borderColor: theme.border,
        },
        kind === 'danger' && { backgroundColor: theme.danger },
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      <Text
        style={[
          styles.btnText,
          kind === 'primary' && { color: '#1a1508' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SegmentPicker<T extends string | number>({
  options,
  value,
  onChange,
  labels,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labels?: (v: T) => string;
}) {
  return (
    <View style={styles.segRow}>
      {options.map((opt) => (
        <Pressable
          key={String(opt)}
          onPress={() => onChange(opt)}
          style={[styles.seg, value === opt && styles.segActive]}
        >
          <Text
            style={[
              styles.segText,
              value === opt && { color: '#1a1508', fontWeight: '700' },
            ]}
          >
            {labels ? labels(opt) : String(opt)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: {
    color: theme.text,
    fontSize: fontSizes.body,
    fontWeight: '600',
  },
  segRow: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  seg: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  segActive: {
    backgroundColor: theme.accent,
  },
  segText: {
    color: theme.textDim,
    fontSize: fontSizes.body,
  },
});
