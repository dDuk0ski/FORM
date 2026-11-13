import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import {
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
    type KeyboardTypeOptions,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components';
import { radii, spacing, typography, useTheme, withAlpha } from '@/theme';

// Create account: second screen of onboarding.
// TODO(onboarding): wire Google sign in.
type FieldProps = {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    keyboardType?: KeyboardTypeOptions;
    secureTextEntry?: boolean;
    hint?: string;
    rightAccessory?: ReactNode;
};

type PasswordRule = { id: string; label: string; test: (password: string) => boolean };

const PASSWORD_RULES: PasswordRule[] = [
    { id: 'length', label: '8+ characters', test: (p) => p.length >= 8 },
    { id: 'number', label: 'One number', test: (p) => /\d/.test(p) },
    { id: 'uppercase', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
    { id: 'symbol', label: 'One symbol', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

// indexed by how many rules are met (0 to 4)
const STRENGTH_LABELS = ['Weak', 'Weak', 'Fair', 'Good', 'Strong'];

function passwordStrength(password: string): string {
    if (password === '') return '';
    const met = PASSWORD_RULES.filter((rule) => rule.test(password)).length;
    return STRENGTH_LABELS[met];
}

function Field({
    label,
    value,
    onChangeText,
    placeholder,
    keyboardType = 'default',
    secureTextEntry = false,
    hint,
    rightAccessory,
}: FieldProps) {
    const { colors } = useTheme();

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[typography.eyebrow, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
        {hint ? <Text style={[typography.caption, { color: colors.textMuted }]}>{hint}</Text> : null}
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radii.md,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={label}
          style={{
            flex: 1,
            color: colors.text,
            fontSize: typography.body.fontSize,
            padding: spacing.md,
          }}
        />
        {rightAccessory}
      </View>
    </View>
  );
}

function RuleCheck({ label, met }: { label: string; met: boolean }) {
  const { colors } = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${met ? 'met' : 'not met'}`}
      style={{ width: '50%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: radii.pill,
          borderWidth: 1.5,
          borderColor: met ? colors.success : colors.border,
          backgroundColor: met ? colors.success : undefined,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {met ? <SymbolView name="checkmark" tintColor={colors.onPrimary} size={11} /> : null}
      </View>
      <Text style={[typography.caption, { color: met ? colors.text : colors.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

export default function SignUpScreen() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const ruleResults = PASSWORD_RULES.map((rule) => ({ ...rule, met: rule.test(password) }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.primary }}>
      <StatusBar style="light" />

      {/* top: header */}
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.xs }}>
          <Text accessibilityRole="header" style={[typography.title, { color: colors.onPrimary }]}>
            Create account
          </Text>
          <Text style={[typography.lead, { color: withAlpha(colors.onPrimary, 0.85) }]}>
            Sign up to track food, workouts, and goals.
          </Text>
        </View>
      </SafeAreaView>

      {/* bottom: signup tab */}
      <View
        style={{
          flex: 4,
          backgroundColor: colors.surface,
          borderTopLeftRadius: radii.xl,
          borderTopRightRadius: radii.xl,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          alwaysBounceVertical={false}
          contentContainerStyle={{
            paddingTop: spacing.xl,
            paddingBottom: insets.bottom + spacing.lg,
          }}
        >
          <View style={{ width: '90%', alignSelf: 'center', gap: spacing.lg }}>
            <Button title="Continue with Google" variant="secondary" onPress={() => {}} />

            {/* horizontal break */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Text style={[typography.caption, { color: withAlpha(colors.textMuted, 0.7) }]}>
                or sign up with email
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>

            {/* email and password fields */}
            <View style={{ gap: spacing.md }}>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
              />
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password"
                hint={passwordStrength(password)}
                secureTextEntry={!showPassword}
                rightAccessory={
                  <Pressable
                    onPress={() => setShowPassword((shown) => !shown)}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    hitSlop={8}
                    style={{ paddingHorizontal: spacing.md }}
                  >
                    <SymbolView
                      name={showPassword ? 'eye.slash' : 'eye'}
                      tintColor={colors.textMuted}
                      size={20}
                    />
                  </Pressable>
                }
              />
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md }}>
              {ruleResults.map((rule) => (
                <RuleCheck key={rule.id} label={rule.label} met={rule.met} />
              ))}
            </View>

            <Button
              title="Create Account"
              onPress={() => router.push({ pathname: '/verify-email', params: { email } })}
            />

            <Text style={[typography.label, { color: colors.textMuted, textAlign: 'center' }]}>
              Already have an account?{' '}
              <Text
                accessibilityRole="link"
                onPress={() => {}}
                style={{ color: colors.primary, fontWeight: '600' }}
              >
                Log in
              </Text>
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}