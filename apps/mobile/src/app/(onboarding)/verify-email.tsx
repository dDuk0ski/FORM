import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components';
import { radii, spacing, typography, useTheme, withAlpha } from '@/theme';

const CODE_LENGTH = 6;

const RESEND_SECONDS = 30;

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}

// Verify email: third screen of onboarding.
export default function VerifyEmailScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const [code, setCode] = useState('');
  const [codeFocused, setCodeFocused] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // keep the bottom block just above the keyboard, without animating along with it
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) =>
      setKeyboardHeight(event.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // tick once per second until it reaches 0
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const handleResend = () => {
    // TODO(onboarding): ask the service to send a new code
    setCode('');
    setSecondsLeft(RESEND_SECONDS);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
       <View style={{ flex: 1, paddingBottom: Math.max(0, keyboardHeight - insets.bottom) }}>
        <View style={{ flex: 1, padding: spacing.lg, justifyContent: 'space-between' }}>
          {/* top block: back arrow, icon, heading, instructions, code boxes, resend line */}
          <View style={{ gap: spacing.lg }}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              style={{ alignSelf: 'flex-start' }}
            >
              <SymbolView name="arrow.left" tintColor={colors.text} size={22} />
            </Pressable>

            <View
              accessible={false}
              style={{
                width: 56,
                height: 56,
                borderRadius: radii.lg,
                backgroundColor: withAlpha(colors.primary, 0.15),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SymbolView name="envelope" tintColor={colors.primary} size={26} />
            </View>

            <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
              Check your email
            </Text>

            <Text style={[typography.label, { color: colors.textMuted }]}>
              We sent a 6-digit code to{' '}
              <Text style={{ fontWeight: '700', color: colors.text }}>{email || 'your email'}</Text>.
              {'\n'}Enter it below to verify your account.
            </Text>

            <View style={{ marginTop: spacing.md }}>
              {/* the six boxes only display the code */}
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{ flexDirection: 'row', gap: spacing.sm }}
              >
                {Array.from({ length: CODE_LENGTH }, (_, index) => {
                  const active = codeFocused && index === Math.min(code.length, CODE_LENGTH - 1);
                  return (
                    <View
                      key={index}
                      style={{
                        flex: 1,
                        aspectRatio: 1,
                        borderWidth: 1,
                        borderColor: active ? colors.primary : colors.border,
                        borderRadius: radii.md,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={[typography.title, { color: colors.text }]}>
                        {code.charAt(index)}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* invisible input stretched over the boxes, so tapping them focuses it */}
              <TextInput
                value={code}
                onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, CODE_LENGTH))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                autoFocus
                caretHidden
                onFocus={() => setCodeFocused(true)}
                onBlur={() => setCodeFocused(false)}
                accessibilityLabel="Verification code"
                style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0 }}
              />
            </View>

            <Text style={[typography.label, { color: colors.textMuted }]}>
              {"Didn't get a code? "}
              {secondsLeft > 0 ? (
                <Text style={{ fontWeight: '700', color: colors.text }}>
                  Resend in {formatCountdown(secondsLeft)}
                </Text>
              ) : (
                <Text
                  accessibilityRole="button"
                  onPress={handleResend}
                  style={{ fontWeight: '700', color: colors.primary }}
                >
                  Resend
                </Text>
              )}
            </Text>
          </View>

          {/* bottom block */}
          <View style={{ gap: spacing.md, marginBottom: spacing.xs }}>
            <Button title="Verify" onPress={() => {}} disabled={code.length < CODE_LENGTH} />
            <Text
              accessibilityRole="link"
              onPress={() => router.back()}
              style={[
                typography.label,
                { color: colors.text, fontWeight: '700', textAlign: 'center' },
              ]}
            >
              Wrong email?
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}