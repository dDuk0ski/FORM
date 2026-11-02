import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Card, Pill, ProgressBar, Row, Screen } from '@/components';
import { Sparkline } from '@/features/brief';
import { formatNumber } from '@/features/nutrition/format';
import { useWeeklyReport } from '@/hooks/useWeeklyReport';
import { useTheme, withAlpha, type ColorTokens } from '@/theme';
import type { LiftProgress } from '@/types/brief';

const PROGRESS: Record<
  LiftProgress['progressed_by'],
  { label: string; tone: 'success' | 'neutral'; icon: SFSymbol }
> = {
  reps: { label: 'More reps', tone: 'success', icon: 'arrow.up.circle.fill' },
  weight: { label: 'More weight', tone: 'success', icon: 'arrow.up.circle.fill' },
  none: { label: 'No change', tone: 'neutral', icon: 'minus.circle.fill' },
};

const MACRO_COLORS: Record<string, keyof ColorTokens> = {
  Calories: 'kcal',
  Protein: 'protein',
  Carbs: 'carb',
  Fat: 'fat',
};

// The weekly report. Next week's recommendations come first; each section then leads with
// its takeaway before the numbers.
export default function WeeklyReportSheet() {
  const { colors, spacing, radii, typography } = useTheme();
  const { data } = useWeeklyReport();
  if (!data) {
    return (
      <Screen title="This week" edges={[]}>
        <ActivityIndicator accessibilityLabel="Loading weekly report" />
      </Screen>
    );
  }
  const { body_weight, real_burn, strength, difficulty, adherence } = data;
  const change = body_weight.end_kg - body_weight.start_kg;
  const signed = (n: number, digits = 0) => `${n > 0 ? '+' : ''}${n.toFixed(digits)}`;

  return (
    <Screen title="This week" eyebrow={weekRange(data.week_start, data.week_end)} edges={[]}>
      <LinearGradient
        colors={[colors.briefStart, colors.briefEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: radii.xl, padding: spacing.lg, gap: spacing.md }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <SymbolView name="sparkles" tintColor={colors.week} size={16} weight="semibold" />
          <Text style={[typography.eyebrow, { color: colors.week }]}>NEXT WEEK</Text>
        </View>
        {data.recommendations.map((rec, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.week,
              }}
            >
              <Text style={[typography.caption, { color: colors.onPrimary, fontWeight: '700' }]}>
                {i + 1}
              </Text>
            </View>
            <Text style={[typography.lead, { color: colors.text, flex: 1 }]}>{rec}</Text>
          </View>
        ))}
      </LinearGradient>

      <Section
        icon="scalemass.fill"
        label="Body weight"
        color={colors.primary}
        headline={body_weight.headline}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}
        >
          <BigNumber
            value={signed(change, 1)}
            unit="kg"
            caption={`${body_weight.start_kg} → ${body_weight.end_kg} kg`}
          />
          <Sparkline values={body_weight.trend_kg} color={colors.primary} width={140} />
        </View>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Goal pace {body_weight.goal_kg_per_week} kg a week
        </Text>
      </Section>

      <Section
        icon="flame.fill"
        label="Real burn"
        color={colors.kcal}
        headline={real_burn.headline}
      >
        <BigNumber
          value={formatNumber(real_burn.tdee_kcal)}
          unit="kcal / day"
          caption={`${signed(real_burn.change_kcal)} kcal from last week`}
        />
        <Row
          label="Your profile's formula said"
          value={`${formatNumber(real_burn.formula_kcal)} kcal`}
        />
      </Section>

      <Section
        icon="dumbbell.fill"
        label="Strength"
        color={colors.train}
        headline={strength.headline}
      >
        {strength.lifts.map((lift) => {
          const p = PROGRESS[lift.progressed_by];
          return (
            <View
              key={lift.name}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.xs,
              }}
            >
              <SymbolView
                name={p.icon}
                tintColor={lift.progressed_by === 'none' ? colors.textMuted : colors.readiness}
                size={24}
              />
              <View style={{ flex: 1 }}>
                <Text style={[typography.label, { color: colors.text }]}>{lift.name}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {lift.summary}
                </Text>
              </View>
              <Pill label={p.label} tone={p.tone} />
            </View>
          );
        })}
      </Section>

      <Section
        icon="gauge.with.dots.needle.50percent"
        label="Difficulty"
        color={colors.alert}
        headline={difficulty.headline}
      >
        <View style={{ flexDirection: 'row' }}>
          <Stat
            value={`${difficulty.sessions_done}/${difficulty.sessions_planned}`}
            label="sessions"
          />
          <Stat value={difficulty.avg_rir.toFixed(1)} label="reps in reserve" />
          <Stat value={`${difficulty.avg_readiness}`} label="avg readiness" />
        </View>
      </Section>

      <Section
        icon="checkmark.seal.fill"
        label="Diet adherence"
        color={colors.readiness}
        headline={adherence.headline}
      >
        <BigNumber
          value={`${adherence.days_on_target}/7`}
          unit="days on target"
          caption={`${adherence.days_logged} of 7 days logged`}
        />
        {adherence.macros.map((m) => (
          <View key={m.label} style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[typography.label, { color: colors.text }]}>{m.label}</Text>
              <Text style={[typography.label, { color: colors.textMuted }]}>{m.pct}%</Text>
            </View>
            <ProgressBar
              value={m.pct}
              max={100}
              color={MACRO_COLORS[m.label] ?? 'primary'}
              accessibilityLabel={`${m.label} ${m.pct}% of target`}
            />
          </View>
        ))}
      </Section>
    </Screen>
  );
}

type SectionProps = {
  icon: SFSymbol;
  label: string;
  color: string;
  headline: string;
  children: ReactNode;
};

function Section({ icon, label, color, headline, children }: SectionProps) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: withAlpha(color, 0.15),
          }}
        >
          <SymbolView name={icon} tintColor={color} size={15} weight="semibold" />
        </View>
        <Text style={[typography.eyebrow, { color }]}>{label.toUpperCase()}</Text>
      </View>
      <Text style={[typography.heading, { color: colors.text }]}>{headline}</Text>
      {children}
    </Card>
  );
}

function BigNumber({ value, unit, caption }: { value: string; unit: string; caption?: string }) {
  const { colors, typography } = useTheme();
  return (
    <View>
      <Text style={[typography.display, { color: colors.text }]}>
        {value}
        <Text style={[typography.rounded, { color: colors.textMuted }]}> {unit}</Text>
      </Text>
      {caption ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>{caption}</Text>
      ) : null}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[typography.display, { color: colors.text, fontSize: 28, lineHeight: 34 }]}>
        {value}
      </Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

/** "2026-10-03", "2026-10-09" as "Oct 3 – 9". */
function weekRange(start: string, end: string): string {
  const fmt = (d: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
  return `${fmt(start, { month: 'short', day: 'numeric' })} – ${fmt(end, { day: 'numeric' })}`;
}
