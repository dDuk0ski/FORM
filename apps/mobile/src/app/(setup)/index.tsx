import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useSaveSetupStep } from '@/hooks/useSetup';
import type { Gender } from '@/types/setup';
import { radii, spacing, typography, useTheme, withAlpha } from '@/theme';
import { Button } from '@/components';

const TOTAL_STEPS = 3;
const CURRENT_STEP = 1;

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
];

type ProfileErrors = { name?: string; gender?: string; birthDate?: string; };

function validateProfile(name: string, gender: Gender | null, birthDate: Date | null): ProfileErrors {
    const errors: ProfileErrors = {};
    if (name.trim() === '') errors.name = 'Enter your name';
    if (gender === null) errors.gender = 'Choose an option';
    if (birthDate === null) errors.birthDate = 'Enter your birthdate';
    return errors;
}

// Where the calendar opens before the user has picked anything.
const DEFAULT_BIRTHDATE = new Date(2000, 0, 1);
const MIN_BIRTHDATE = new Date(1900, 0, 1);

// YYYY-MM-DD in the user's local time. toISOString() converts to UTC first,
// which can shift the date by a day.
function toLocalISODate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

type FieldProps = {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    maxLength?: number;
    error?: string;
};

function Field({ label, value, onChangeText, placeholder, maxLength, error }: FieldProps) {
    const { colors } = useTheme();

    return (
      <View style={{ gap: spacing.xs }}>
        <Text style={[typography.label, { color: colors.textMuted, textTransform: 'none' }]}>
          {label}
        </Text>
        <View style={{ borderWidth: 1, borderColor: error ? colors.danger : colors.border, borderRadius: radii.md }}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={maxLength}
            accessibilityLabel={label}
            style={{
              color: colors.text,
              fontSize: typography.body.fontSize,
              padding: spacing.md,
            }}
          />
        </View>
        {error ? (
          <Text accessibilityRole="alert" style={[typography.caption, { color: colors.danger }]}>
            {error}
          </Text>
        ) : null}
      </View>
    );
}

export default function SetupProfileScreen() {
    const { colors, scheme } = useTheme();
    const [name, setName] = useState('');
    const [gender, setGender] = useState<Gender | null>(null);
    const [birthDate, setBirthDate] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    // The date being browsed in the calendar. It only becomes birthDate when the user taps Done.
    const [draftDate, setDraftDate] = useState<Date>(DEFAULT_BIRTHDATE);
    const [submitted, setSubmitted] = useState(false);
    const errors: ProfileErrors = submitted ? validateProfile(name, gender, birthDate) : {};
    const saveStep = useSaveSetupStep();

    // TODO(setup): upload and save photo
    const handleUploadPhoto = () => {};

    const handleContinue = () => {
        setSubmitted(true);
        const found = validateProfile(name, gender, birthDate);
        if (Object.keys(found).length > 0 || gender === null || birthDate === null) return;

        saveStep.mutate(
            { profile: { name: name.trim(), gender, birthDate: toLocalISODate(birthDate) } },
            { onSuccess: () => router.push('/body-stats') },
        );
    };

    const openDatePicker = () => {
        setDraftDate(birthDate ?? DEFAULT_BIRTHDATE);
        setShowDatePicker(true);
    };

    const confirmDate = () => {
        setBirthDate(draftDate);
        setShowDatePicker(false);
    };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        {/* header row: back arrow spot, progress bar in thirds, skip */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 22 }} />

          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`Step ${CURRENT_STEP} of ${TOTAL_STEPS}`}
            style={{ flex: 1, flexDirection: 'row', gap: spacing.xs, marginHorizontal: spacing.md }}
          >
            {Array.from({ length: TOTAL_STEPS }, (_, index) => (
              <View
                key={index}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: radii.pill,
                  backgroundColor: index < CURRENT_STEP ? colors.primary : colors.border,
                }}
              />
            ))}
          </View>

          <Pressable
            onPress={() => router.push('/body-stats')}
            accessibilityRole="button"
            hitSlop={12}
          >
            <Text style={[typography.label, { color: colors.textMuted, fontWeight: '600' }]}>
              Skip
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        alwaysBounceVertical={false}
        contentContainerStyle={{
          flexGrow: 1,
          padding: spacing.lg,
          justifyContent: 'space-between',
          gap: spacing.xl,
        }}
      >
        <View style={{ gap: spacing.lg }}>
          {/* heading group */}
          <View style={{ gap: spacing.md, marginTop: spacing.md, paddingLeft: spacing.sm }}>
            <Text style={[typography.label, { color: colors.text }]}>
              {`STEP ${CURRENT_STEP} OF ${TOTAL_STEPS}`}
            </Text>
            <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
              Set up your profile
            </Text>
            <Text style={[typography.label, { color: colors.textMuted }]}>
              Add a photo and a few basics.
            </Text>
          </View>
          {/* photo */}
          <View style={{ alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
            <Pressable
              onPress={handleUploadPhoto}
              accessibilityRole="button"
              accessibilityLabel="Upload photo"
              style={{
                width: 104,
                height: 104,
                borderRadius: radii.pill,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: withAlpha(colors.textMuted, 0.45),
                backgroundColor: withAlpha(colors.textMuted, 0.12),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SymbolView name="person.fill" tintColor={withAlpha(colors.textMuted, 0.7)} size={44} />
            </Pressable>
            <Text
              accessibilityRole="button"
              onPress={handleUploadPhoto}
              style={[typography.label, { color: colors.primary, fontWeight: '600' }]}
            >
              Upload photo
            </Text>
          </View>
          {/* name field */}
          <View style={{ width: '95%', alignSelf: 'center', marginTop: spacing.xl, gap: spacing.lg }}>
            <Field
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              maxLength={50}
              error={errors.name}
            />
            {/* birthdate field */}
            <View style={{ gap: spacing.xs }}>
              <Text style={[typography.label, { color: colors.textMuted, textTransform: 'none' }]}>
                  Birthdate
              </Text>

              <Pressable
                  onPress={openDatePicker}
                  accessibilityRole="button"
                  accessibilityLabel="Select birthdate"
                  style={{
                      borderWidth: 1,
                      borderColor: errors.birthDate ? colors.danger : colors.border,
                      borderRadius: radii.md,
                      padding: spacing.md,
                  }}
              >
                  <Text style={[typography.body, { color: birthDate ? colors.text : colors.textMuted }]}>
                      {birthDate ? birthDate.toLocaleDateString() : 'Select your birthdate'}
                  </Text>
              </Pressable>

              {errors.birthDate ? (
                  <Text accessibilityRole="alert" style={[typography.caption, { color: colors.danger }]}>
                      {errors.birthDate}
                  </Text>
              ) : null}

              {/* calendar popup*/}
              <Modal
                  visible={showDatePicker}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setShowDatePicker(false)}
              >
                  <View style={{ flex: 1, justifyContent: 'center', padding: spacing.lg }}>
                      {/* dimmed backdrop, tap to cancel */}
                      <Pressable
                          onPress={() => setShowDatePicker(false)}
                          accessibilityLabel="Close date picker"
                          style={{
                              position: 'absolute',
                              top: 0, right: 0, bottom: 0, left: 0,
                              backgroundColor: withAlpha(colors.shadow, 0.4),
                          }}
                      />

                      <View
                          style={{
                              backgroundColor: colors.surface,
                              borderRadius: radii.xl,
                              padding: spacing.md,
                              gap: spacing.sm,
                          }}
                      >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.sm }}>
                              <Pressable onPress={() => setShowDatePicker(false)} accessibilityRole="button" hitSlop={12}>
                                  <Text style={[typography.body, { color: colors.textMuted }]}>Cancel</Text>
                              </Pressable>
                              <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>
                                  Birthdate
                              </Text>
                              <Pressable onPress={confirmDate} accessibilityRole="button" hitSlop={12}>
                                  <Text style={[typography.body, { color: colors.primary, fontWeight: '600' }]}>Done</Text>
                              </Pressable>
                          </View>

                          <DateTimePicker
                              value={draftDate}
                              mode="date"
                              display="inline"
                              minimumDate={MIN_BIRTHDATE}
                              maximumDate={new Date()}
                              themeVariant={scheme}
                              accentColor={colors.primary}
                              onValueChange={(_, selectedDate) => {
                                  if (selectedDate) setDraftDate(selectedDate);
                              }}
                          />
                      </View>
                  </View>
              </Modal>
            </View>
            {/* gender buttons */}
            <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
              <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: spacing.sm }}>
                {GENDER_OPTIONS.map((option) => {
                  const selected = gender === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setGender(option.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={{
                        flex: 1,
                        paddingVertical: spacing.md,
                        borderRadius: radii.pill,
                        borderWidth: 1,
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.primary : undefined,
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={[
                          typography.label,
                          { fontWeight: '700', color: selected ? colors.onPrimary : colors.text },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {errors.gender ? (
                <Text accessibilityRole="alert" style={[typography.caption, { color: colors.danger }]}>
                  {errors.gender}
                </Text>
              ) : null}
              <Text style={[typography.label, { color: colors.textMuted }]}>
                Used only to estimate your daily calories.
              </Text>
            </View>
          </View>
        </View>

        {/* bottom block */}
        <View style={{ width: '95%', alignSelf: 'center', gap: spacing.sm }}>
          {saveStep.isError ? (
            <Text accessibilityRole="alert" style={[typography.caption, { color: colors.danger, textAlign: 'center' }]}>
              {saveStep.error.message}
            </Text>
          ) : null}
          <Button title="Continue" onPress={handleContinue} disabled={saveStep.isPending} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}