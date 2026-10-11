import { Screen } from '@/components';

// Train: workout logging and readiness-adjusted sessions.
// TODO(Train): start a workout, pick from `exercises`, log sets (weight_kg,
// reps, rir) into workouts / workout_sets. NumberStepper fits weight and reps.
// TODO(Train): pre-fill the next set from ml.getNextSet (GET /next-set).
// TODO(Train): e1RM chart per lift from workout_sets.e1rm.
// TODO(Train): show readiness advice from ml.getReadiness (GET /readiness).
export default function TrainScreen() {
  return <Screen title="Train" />;
}
