import { useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';

import { useSaveSetupStep } from '@/hooks/useSetup';
import type { ActivityLevel } from '@/types/setup';
import { useCompleteOnboarding } from '@/hooks/useOnboarding';
import { radii, spacing, typography, useTheme, withAlpha } from '@/theme';
import { Button } from '@/components';

const TOTAL_STEPS = 3;
const CURRENT_STEP = 2;

const INPUT_HEIGHT = 28;
const DIGIT_WIDTH = typography.lead.fontSize * 0.6;
const CARET_ROOM = 2;

type FieldKey = 'feet' | 'inches' | 'weight' | 'goalWeight';

const BODY_FIELDS: {
    label: string;
    inputs: { key: FieldKey; placeholder: string; suffix: string; maxLength: number; next?: FieldKey; prev?: FieldKey }[];
}[] = [
    {
        label: 'Height',
        inputs: [
            { key: 'feet', placeholder: '5', suffix: 'ft', maxLength: 1, next: 'inches' },
            { key: 'inches', placeholder: '6', suffix: 'in', maxLength: 2, prev: 'feet' },
        ],
    },
    {
        label: 'Current weight',
        inputs: [{ key: 'weight', placeholder: '140', suffix: 'lbs', maxLength: 3 }],
    },
    {
        label: 'Goal weight',
        inputs: [{ key: 'goalWeight', placeholder: '130', suffix: 'lbs', maxLength: 3 }],
    },
];

type BodyStatsErrors = { height?: string; weight?: string; goalWeight?: string; activity?: string };

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; caption: string }[] = [
    { value: 'sedentary', label: 'Sedentary', caption: 'Desk job, little exercise' },
    { value: 'light', label: 'Light', caption: '1-3 workouts a week' },
    { value: 'moderate', label: 'Moderate', caption: '3-5 workouts a week' },
    { value: 'very active', label: 'Very active', caption: '6-7 workouts a week' },
];

function validateBodyStats(values: Record<FieldKey, string>, activity: ActivityLevel | null): BodyStatsErrors {
    const errors: BodyStatsErrors = {};
    const feet = Number(values.feet);
    const inches = Number(values.inches);

    if (feet < 1) errors.height = 'Enter your height in feet';
    else if (values.inches === '') errors.height = 'Enter your height in inches';
    else if (inches > 11) errors.height = 'Inches must be 0-11';
    if (Number(values.weight) < 1) errors.weight = 'Enter your current weight';
    if (Number(values.goalWeight) < 1) errors.goalWeight = 'Enter your goal weight';
    if (activity === null) errors.activity = 'Choose an activity level';
    return errors;
}

export default function SetupBodyStatsScreen() {
    const { colors } = useTheme();
    const [values, setValues] = useState<Record<FieldKey, string>>({ feet: '', inches: '', weight: '', goalWeight: '' });
    const [activity, setActivity] = useState<ActivityLevel | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const errors: BodyStatsErrors = submitted ? validateBodyStats(values, activity) : {};
    const saveStep = useSaveSetupStep();
    const inputRefs = useRef<Partial<Record<FieldKey, ComponentRef<typeof TextInput> | null>>>({});
    // TEMP: skip finishes onboarding
    const completeOnboarding = useCompleteOnboarding();

    const handleContinue = () => {
        setSubmitted(true);
        const found = validateBodyStats(values, activity);
        if (Object.keys(found).length > 0 || activity === null) return;

        saveStep.mutate(
            {
                bodyStats: {
                    heightFeet: Number(values.feet),
                    heightInches: Number(values.inches),
                    weight: Number(values.weight),
                    goalWeight: Number(values.goalWeight),
                    activity,
                },
            },
            { onSuccess: () => router.push('/targets') },
        );
    };

    return (
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
                {/* header row: back arrow, progress bar in thirds, skip */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <Pressable
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                        hitSlop={12}
                    >
                        <SymbolView name="chevron.left" tintColor={colors.text} size={22} />
                    </Pressable>

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
                        onPress={() => completeOnboarding.mutate()}
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
                keyboardDismissMode="on-drag"
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
                            Your body and goal
                        </Text>
                        <Text style={[typography.label, { color: colors.textMuted }]}>
                            We use this to work out your daily targets.
                        </Text>
                    </View>

                    {/* body stats card */}
                    <View
                        style={{
                            width: '95%',
                            alignSelf: 'center',
                            marginTop: spacing.md,
                            backgroundColor: colors.surface,
                            borderRadius: radii.lg,
                        }}
                    >
                        {BODY_FIELDS.map((field, index) => (
                            <View key={field.label}>
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: spacing.lg,
                                    }}
                                >
                                    <View style={{ gap: spacing.xs }}>
                                        <Text style={[typography.label, { color: colors.textMuted }]}>{field.label}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                                            {field.inputs.map((input) => (
                                                <View
                                                    key={input.key}
                                                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
                                                >
                                                    <TextInput
                                                        ref={(node) => {
                                                            inputRefs.current[input.key] = node;
                                                        }}
                                                        value={values[input.key]}
                                                        onChangeText={(text) => {
                                                            const digits = text.replace(/\D/g, '');
                                                            setValues((prev) => ({ ...prev, [input.key]: digits }));
                                                            if (input.next && digits.length === input.maxLength) {
                                                                inputRefs.current[input.next]?.focus();
                                                            }
                                                        }}
                                                        onKeyPress={({ nativeEvent }) => {
                                                            if (nativeEvent.key === 'Backspace' && values[input.key] === '' && input.prev) {
                                                                const prevKey = input.prev;
                                                                setValues((prev) => ({ ...prev, [prevKey]: '' }));
                                                                inputRefs.current[prevKey]?.focus();
                                                            }
                                                        }}
                                                        placeholder={input.placeholder}
                                                        placeholderTextColor={withAlpha(colors.textMuted, 0.5)}
                                                        keyboardType="number-pad"
                                                        maxLength={input.maxLength}
                                                        selectTextOnFocus
                                                        accessibilityLabel={`${field.label} ${input.suffix}`}
                                                        style={[
                                                            typography.lead,
                                                            {
                                                                color: colors.text,
                                                                fontWeight: '700',
                                                                padding: 0,
                                                                height: INPUT_HEIGHT,
                                                                lineHeight: undefined,
                                                                fontVariant: ['tabular-nums'],
                                                                width: (values[input.key].length || input.placeholder.length) * DIGIT_WIDTH + CARET_ROOM,
                                                            },
                                                        ]}
                                                    />
                                                    <Text
                                                        style={[
                                                            typography.lead,
                                                            { color: colors.text, fontWeight: '700', lineHeight: undefined },
                                                        ]}
                                                    >
                                                        {input.suffix}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                    <Pressable
                                        onPress={() => {
                                            const target = field.inputs.find((input) => values[input.key] === '') ?? field.inputs[0];
                                            inputRefs.current[target.key]?.focus();
                                        }}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Edit ${field.label}`}
                                        hitSlop={12}
                                    >
                                        <SymbolView name="pencil" tintColor={colors.textMuted} size={18} />
                                    </Pressable>
                                </View>
                                {index < BODY_FIELDS.length - 1 ? (
                                    <View style={{ height: 1, width: '90%', alignSelf: 'center', backgroundColor: colors.border }} />
                                ) : null}
                            </View>
                        ))}
                    </View>
                    {errors.height || errors.weight || errors.goalWeight ? (
                        <Text
                            accessibilityRole="alert"
                            style={[typography.caption, { color: colors.danger, width: '95%', alignSelf: 'center' }]}
                        >
                            {errors.height ?? errors.weight ?? errors.goalWeight}
                        </Text>
                    ) : null}

                    {/* activity level */}
                    <View style={{ width: '95%', alignSelf: 'center', gap: spacing.md }}>
                        <Text style={[typography.label, { color: colors.textMuted }]}>Activity level</Text>
                        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                            {ACTIVITY_OPTIONS.map((option) => {
                                const selected = activity === option.value;
                                return (
                                    <Pressable
                                        key={option.value}
                                        onPress={() => setActivity(option.value)}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected }}
                                        style={{
                                            flexBasis: '45%',
                                            flexGrow: 1,
                                            gap: spacing.xs,
                                            padding: spacing.md,
                                            borderRadius: radii.lg,
                                            borderWidth: 1.5,
                                            borderColor: selected ? colors.textMuted : colors.border,
                                            backgroundColor: colors.surface,
                                        }}
                                    >
                                        <Text style={[typography.label, { color: colors.text, fontWeight: '700' }]}>
                                            {option.label}
                                        </Text>
                                        <Text style={[typography.caption, { color: colors.textMuted }]}>{option.caption}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                        {errors.activity ? (
                            <Text accessibilityRole="alert" style={[typography.caption, { color: colors.danger }]}>
                                {errors.activity}
                            </Text>
                        ) : null}
                    </View>
                </View>

                {/* bottom block */}
                <View style={{ width: '95%', alignSelf: 'center' }}>
                    <Button title="Continue" onPress={handleContinue} disabled={saveStep.isPending} />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}