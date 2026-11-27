import { useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';

import { useCompleteOnboarding } from '@/hooks/useOnboarding';
import { useSaveSetupStep } from '@/hooks/useSetup';
import type { MacroPreset as Preset } from '@/types/setup';
import { radii, spacing, typography, useTheme, withAlpha } from '@/theme';
import { Button } from '@/components';

// TODO(setup): replace mock calorie values with the real calorie estimate from the backend
// TODO(setup): replace placeholder preset % and MIN_CALORIES with agreed upon constants
const MOCK_CALORIES = 2000;
const MOCK_SUGGESTED = 2000;

const TOTAL_STEPS = 3;
const CURRENT_STEP = 3;

const PRESETS: { value: Preset; label: string }[] = [
    { value: 'balanced', label: 'Balanced' },
    { value: 'high-protein', label: 'High protein' },
    { value: 'low-carb', label: 'Low carb' },
];

type Macro = 'protein' | 'carbs' | 'fat';

const MACROS: { key: Macro; label: string }[] = [
    { key: 'protein', label: 'Protein' },
    { key: 'carbs', label: 'Carbs' },
    { key: 'fat', label: 'Fats' },
];

const KCAL_PER_GRAM: Record<Macro, number> = { protein: 4, carbs: 4, fat: 9 };
const GRAM_STEP = 1;
const MAX_GRAMS = 999;
const ROW_HEIGHT = 56;
const BUTTON_SIZE = 50;
const CALORIE_INPUT_HEIGHT = 34;
const CALORIE_DIGIT_WIDTH = typography.title.fontSize * 0.66;
const KCAL_LIFT = 3;
const MIN_CALORIES = 800;
const CALORIE_ERROR = `Enter at least ${MIN_CALORIES} kcal`;

const SPLITS: Record<Preset, Record<Macro, number>> = {
    balanced: { protein: 30, carbs: 40, fat: 30 },
    'high-protein': { protein: 40, carbs: 30, fat: 30 },
    'low-carb': { protein: 35, carbs: 20, fat: 45 },
};

// percent split to grams, using the calories-per-gram of each macro
function gramsFromSplit(calories: number, split: Record<Macro, number>): Record<Macro, number> {
    return {
        protein: Math.round((calories * split.protein) / 100 / KCAL_PER_GRAM.protein),
        carbs: Math.round((calories * split.carbs) / 100 / KCAL_PER_GRAM.carbs),
        fat: Math.round((calories * split.fat) / 100 / KCAL_PER_GRAM.fat),
    };
}

export default function SetupTargetsScreen() {
    const { colors } = useTheme();
    const macroColors: Record<Macro, string> = { protein: colors.macroProtein, carbs: colors.macroCarbs, fat: colors.macroFat };
    const [preset, setPreset] = useState<Preset | null>('balanced');
    const [calorieDraft, setCalorieDraft] = useState<string | null>(null);
    const [calories, setCalories] = useState(MOCK_CALORIES);
    const [calorieError, setCalorieError] = useState<string | null>(null);
    const calorieRef = useRef<ComponentRef<typeof TextInput> | null>(null);
    const saveStep = useSaveSetupStep();
    const [grams, setGrams] = useState<Record<Macro, number>>(() => gramsFromSplit(MOCK_CALORIES, SPLITS.balanced));

    const macroKcal = (macro: Macro) => grams[macro] * KCAL_PER_GRAM[macro];
    const macroTotal = MACROS.reduce((sum, macro) => sum + macroKcal(macro.key), 0);
    const calorieText = calorieDraft ?? String(calories);

    const completeOnboarding = useCompleteOnboarding();

    const adjustGrams = (macro: Macro, delta: number) => {
        if (delta < 0 && !canDecrease(macro)) return;

        setCalorieDraft(null);
        setCalorieError(null);
        Keyboard.dismiss();
        setPreset(null);
        const nextGrams = Math.min(MAX_GRAMS, Math.max(0, grams[macro] + delta));
        setGrams({ ...grams, [macro]: nextGrams });
        // add only what actually changed so the typed calories don't snap to the rounded macro sum
        setCalories(calories + (nextGrams - grams[macro]) * KCAL_PER_GRAM[macro]);
    };

    // a decrease is allowed only if there's something to remove and the total stays at or above the minimum calories
    const canDecrease = (macro: Macro) =>
        grams[macro] > 0 && calories - GRAM_STEP * KCAL_PER_GRAM[macro] >= MIN_CALORIES;

    const applyPreset = (next: Preset) => {
        setCalorieDraft(null);
        setCalorieError(null);
        Keyboard.dismiss();
        setPreset(next);
        setGrams(gramsFromSplit(calories, SPLITS[next]));
    };

    // valid calories rescale the macros, an invalid entry stays in the field with an error
    const commitCalories = () => {
        if (calorieDraft === null) return;
        const entered = Number(calorieDraft);
        if (entered < MIN_CALORIES) {
            setCalorieError(CALORIE_ERROR);
            return;
        }
        setCalorieDraft(null);
        setCalorieError(null);
        const split =
            macroTotal > 0
                ? {
                    protein: (macroKcal('protein') / macroTotal) * 100,
                    carbs: (macroKcal('carbs') / macroTotal) * 100,
                    fat: (macroKcal('fat') / macroTotal) * 100,
                }
                : SPLITS.balanced;
        setCalories(entered);
        setGrams(gramsFromSplit(entered, split));
    };

    const handleContinue = () => {
        if (calorieDraft !== null && Number(calorieDraft) < MIN_CALORIES) {
            setCalorieError(CALORIE_ERROR);
            return;
        }
        saveStep.mutate(
            {
                targets: {
                    calories,
                    preset,
                    proteinG: grams.protein,
                    carbsG: grams.carbs,
                    fatG: grams.fat,
                },
            },
            { onSuccess: () => completeOnboarding.mutate() },
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
                            Your daily targets
                        </Text>
                        <Text style={[typography.label, { color: colors.textMuted }]}>
                            Suggested from your profile. Change them anytime.
                        </Text>
                    </View>

                    {/* calories card */}
                    <View
                        style={{
                            width: '95%',
                            alignSelf: 'center',
                            marginTop: spacing.md,
                            backgroundColor: colors.surface,
                            borderRadius: radii.lg,
                            padding: spacing.lg,
                            gap: spacing.lg,
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ gap: spacing.xs }}>
                                <Text style={[typography.label, { color: colors.textMuted }]}>Daily calories</Text>
                                {/* calorie number row: editable input + kcal */}
                                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs }}>
                                    <TextInput
                                        ref={calorieRef}
                                        value={calorieText}
                                        onFocus={() => {
                                            if (calorieDraft === null) setCalorieDraft(String(calories));
                                        }}
                                        onChangeText={(text) => {
                                            setCalorieDraft(text.replace(/\D/g, ''));
                                            setCalorieError(null);
                                        }}
                                        onBlur={commitCalories}
                                        keyboardType="number-pad"
                                        maxLength={4}
                                        selectTextOnFocus
                                        accessibilityLabel="Daily calories"
                                        style={[
                                            typography.title,
                                            {
                                                color: calorieError ? colors.danger : colors.text,
                                                fontWeight: '700',
                                                padding: 0,
                                                height: CALORIE_INPUT_HEIGHT,
                                                lineHeight: undefined,
                                                fontVariant: ['tabular-nums'],
                                                width: Math.max(1, calorieText.length) * CALORIE_DIGIT_WIDTH,
                                            },
                                        ]}
                                    />
                                    <Text
                                        style={[
                                            typography.lead,
                                            { color: colors.textMuted, lineHeight: undefined, marginBottom: KCAL_LIFT },
                                        ]}
                                    >
                                        kcal
                                    </Text>
                                </View>
                                <Text style={[typography.caption, { color: withAlpha(colors.textMuted, 0.7) }]}>
                                    {`Suggested ${MOCK_SUGGESTED}`}
                                </Text>
                            </View>
                            <Pressable
                                onPress={() => calorieRef.current?.focus()}
                                accessibilityRole="button"
                                accessibilityLabel="Edit daily calories"
                                hitSlop={12}
                            >
                                <SymbolView name="pencil" tintColor={colors.textMuted} size={28} />
                            </Pressable>
                        </View>
                    </View>

                    {calorieError ? (
                        <Text
                            accessibilityRole="alert"
                            style={[typography.caption, { color: colors.danger, width: '95%', alignSelf: 'center' }]}
                        >
                            {calorieError}
                        </Text>
                    ) : null}

                    {/* preset buttons */}
                        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: spacing.sm }}>
                            {PRESETS.map((option) => {
                                const selected = preset === option.value;
                                return (
                                    <Pressable
                                        key={option.value}
                                        onPress={() => applyPreset(option.value)}
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

                    {/* macros card */}
                    <View
                        style={{
                            width: '95%',
                            alignSelf: 'center',
                            backgroundColor: colors.surface,
                            borderRadius: radii.lg,
                            paddingTop: spacing.lg,
                            paddingBottom: spacing.xs,
                        }}
                    >
                        {/* split bar: each segment's flex is its share of the calories */}
                        <View
                            accessible
                            accessibilityLabel="Macro split"
                            style={{
                                width: '95%',
                                alignSelf: 'center',
                                flexDirection: 'row',
                                gap: spacing.xs,
                                height: 12,
                                marginBottom: spacing.sm,
                            }}
                        >
                            {MACROS.map((macro) => (
                                <View
                                    key={macro.key}
                                    style={{
                                        flex: macroKcal(macro.key),
                                        borderRadius: radii.pill,
                                        backgroundColor: macroColors[macro.key],
                                    }}
                                />
                            ))}
                        </View>

                        {MACROS.map((macro, index) => {
                            const kcal = macroKcal(macro.key);
                            const percent = macroTotal > 0 ? Math.round((kcal / macroTotal) * 100) : 0;

                            return (
                                <View key={macro.key}>
                                    <View
                                        style={{
                                            width: '95%',
                                            alignSelf: 'center',
                                            height: ROW_HEIGHT,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: spacing.md,
                                        }}
                                    >
                                        <View
                                            style={{
                                                width: 12,
                                                height: 12,
                                                borderRadius: radii.pill,
                                                backgroundColor: macroColors[macro.key],
                                            }}
                                        />
                                        <View style={{ flex: 1 }}>
                                            <Text style={[typography.body, { color: colors.text, fontWeight: '700' }]}>
                                                {macro.label}
                                            </Text>
                                            <Text style={[typography.caption, { color: withAlpha(colors.textMuted, 0.7) }]}>
                                                {`${kcal} kcal · ${percent}%`}
                                            </Text>
                                        </View>
                                        <Text
                                            style={[
                                                typography.body,
                                                { color: colors.text, fontWeight: '700', minWidth: 48, textAlign: 'right' },
                                            ]}
                                        >
                                            {`${grams[macro.key]}g`}
                                        </Text>
                                        <Pressable
                                            onPress={() => adjustGrams(macro.key, -GRAM_STEP)}
                                            disabled={!canDecrease(macro.key)}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Decrease ${macro.label}`}
                                            style={{
                                                width: BUTTON_SIZE,
                                                height: BUTTON_SIZE,
                                                borderRadius: radii.pill,
                                                borderWidth: 1,
                                                borderColor: colors.border,
                                                backgroundColor: colors.surface,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                opacity: canDecrease(macro.key) ? 1 : 0.35,
                                            }}
                                        >
                                            <SymbolView name="minus" tintColor={colors.text} size={18} />
                                        </Pressable>
                                        <Pressable
                                            onPress={() => adjustGrams(macro.key, GRAM_STEP)}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Increase ${macro.label}`}
                                            style={{
                                                width: BUTTON_SIZE,
                                                height: BUTTON_SIZE,
                                                borderRadius: radii.pill,
                                                backgroundColor: colors.text,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <SymbolView name="plus" tintColor={colors.background} size={18} />
                                        </Pressable>
                                    </View>
                                    {index < MACROS.length - 1 ? (
                                        <View
                                            style={{ height: 1, width: '90%', alignSelf: 'center', backgroundColor: colors.border }}
                                        />
                                    ) : null}
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* bottom block */}
                <View style={{ width: '95%', alignSelf: 'center', gap: spacing.sm }}>
                    {completeOnboarding.isError ? (
                        <Text accessibilityRole="alert" style={[typography.caption, { color: colors.danger, textAlign: 'center' }]}>
                            {completeOnboarding.error.message}
                        </Text>
                    ) : null}
                    <Button
                        title="Continue"
                        onPress={handleContinue}
                        disabled={saveStep.isPending || completeOnboarding.isPending}
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}