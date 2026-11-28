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
import { useSignIn } from '@/hooks/useSession';
import { radii, spacing, typography, useTheme, withAlpha } from '@/theme';

// Log in: for people who already have an account
// TODO(onboarding): wire Google sign in, forgot password
type FieldProps = {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    keyboardType?: KeyboardTypeOptions;
    secureTextEntry?: boolean;
    error?: string;
    rightAccessory?: ReactNode;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type LoginErrors = { email?: string; password?: string };

function validateLogin(email: string, password: string): LoginErrors {
    const errors: LoginErrors = {};

    if (email.trim() === '') errors.email = 'Enter your email';
    else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Enter a valid email address';

    if (password === '') errors.password = 'Enter your password';

    return errors;
}

function Field({
    label,
    value,
    onChangeText,
    placeholder,
    keyboardType = 'default',
    secureTextEntry = false,
    error,
    rightAccessory,
}: FieldProps) {
    const { colors } = useTheme();

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[typography.label, { color: colors.textMuted, textTransform: 'none' }]}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
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
      {error ? (
        <Text accessibilityRole="alert" style={[typography.caption, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export default function LoginScreen() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const signIn = useSignIn();
    const errors: LoginErrors = submitted ? validateLogin(email, password) : {};

    const handleEmailChange = (text: string) => {
      if (signIn.isError) signIn.reset();
      setEmail(text);
    };

    const handlePasswordChange = (text: string) => {
      if (signIn.isError) signIn.reset();
      setPassword(text);
    };

    // on success the session updates and the root layout moves on by itself
    const handleSubmit = () => {
      setSubmitted(true);
      if (signIn.isPending) return;

      const cleanEmail = email.trim();
      const found = validateLogin(cleanEmail, password);
      if (found.email || found.password) return;

      signIn.mutate({ email: cleanEmail, password });
    };

  return (
    <View style={{ flex: 1, backgroundColor: colors.primarySoft }}>
      <StatusBar style="dark" />

      {/* top: header */}
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.xs }}>
          <Text accessibilityRole="header" style={[typography.title, { color: colors.onPrimarySoft }]}>
            Log in
          </Text>
          <Text style={[typography.lead, { color: withAlpha(colors.onPrimarySoft, 0.7) }]}>
            Welcome back to FORM.
          </Text>
        </View>
      </SafeAreaView>

      {/* bottom: login tab */}
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
            <Button title="Continue with Google" variant="softOutline" onPress={() => {}} />

            {/* horizontal break */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Text style={[typography.caption, { color: withAlpha(colors.textMuted, 0.7) }]}>
                or log in with email
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>

            {/* email and password fields */}
            <View style={{ gap: spacing.md }}>
              <Field
                label="Email"
                value={email}
                onChangeText={handleEmailChange}
                placeholder="you@example.com"
                keyboardType="email-address"
                error={errors.email}
              />
              <Field
                label="Password"
                value={password}
                onChangeText={handlePasswordChange}
                placeholder="Your password"
                error={errors.password}
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

            <Button title="Log In" variant="soft" onPress={handleSubmit} disabled={signIn.isPending} />

            {signIn.isError ? (
              <Text
                accessibilityRole="alert"
                style={[typography.label, { color: colors.danger, textAlign: 'center' }]}
              >
                {signIn.error.message}
              </Text>
            ) : null}

            <Text style={[typography.label, { color: colors.textMuted, textAlign: 'center' }]}>
              Don&apos;t have an account?{' '}
              <Text
                accessibilityRole="link"
                onPress={() => router.replace('/signup')}
                style={{ color: colors.link, fontWeight: '600' }}
              >
                Sign up
              </Text>
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
