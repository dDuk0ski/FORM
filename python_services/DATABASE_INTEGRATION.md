# FORM Database Integration Checklist

## Goal

Connect the Python workout-generation and Bayesian progression systems to Supabase while keeping the Python models independent of database code.

## 1. Database developer: What needs to be implemented

### A. Exercises Stored within the Database

Store each exercise from normalized_exercises.json using this format:

Example:
{
    "id": "0859",
    "name": "wrist rollerer",
    "classification": {
      "category": "strength",
      "body_region": "upper_body",
      "movement_group": "forearm",
      "volume_profile": "grip",
      "exercise_type": "isolation"
    },
    "equipment": [
      "weighted"
    ],
    "muscles": {
      "primary": [
        "forearms"
      ],
      "secondary": [
        "biceps",
        "triceps"
      ],
      "groups": [
        "forearms",
        "biceps",
        "triceps"
      ],
      "volume": {
        "forearms": 1.0
      }
    },
    "movement": {
      "pattern": "forearm",
      "unilateral": false,
      "compound": false
    },
    "instructions": {
      "en": "Attach a weight to one end of a rope or bar. Hold the other end of the rope or bar with both hands, palms facing down. Stand with your feet shoulder-width apart and your arms fully extended in front of you. Slowly roll the weight up towards your hands by flexing your wrists. Pause for a moment at the top, then slowly lower the weight back down to the starting position. Repeat for the desired number of repetitions."
    },
    "instruction_steps": {
      "en": [
        "Attach a weight to one end of a rope or bar.",
        "Hold the other end of the rope or bar with both hands, palms facing down.",
        "Stand with your feet shoulder-width apart and your arms fully extended in front of you.",
        "Slowly roll the weight up towards your hands by flexing your wrists.",
        "Pause for a moment at the top, then slowly lower the weight back down to the starting position.",
        "Repeat for the desired number of repetitions."
      ]
    }


### B. Retrieve user information

Retrieve the authenticated user's:
- Fitness goal.
- Experience level.
- Training days per week.
- Workout split.
- Workout duration.
- Available equipment.
- Split rotation position.

Map this information into the Python `WorkoutRequest`.

### C. Retrieve exercises

Retrieve eligible exercises from the existing Supabase exercise catalog.

The Python workout generator requires the following exercise fields:

- `id`
- `name`
- `classification.category`
- `equipment`
- `muscles.primary`
- `muscles.secondary`
- `muscles.groups`
- `movement.pattern`
- `movement.compound`

Convert the retrieved database records into this structure:

```python
{
    "id": "0859",
    "name": "Wrist Roller",
    "classification": {
        "category": "strength"
    },
    "equipment": ["weighted"],
    "muscles": {
        "primary": ["forearms"],
        "secondary": ["biceps", "triceps"],
        "groups": ["forearms", "biceps", "triceps"]
    },
    "movement": {
        "pattern": "forearm",
        "compound": False
    }
}
```

Pass the resulting list into:

```python
workout_generator = build_workout_generator(
    exercise_records=exercise_records
)
```

**Important:** The database does not need to retrieve or pass exercise instructions, instruction steps, or other display-related information to the workout generator. Those fields can remain in the exercise catalog for use elsewhere in the application.

### D. Save generated workouts

When a workout is generated, save it before the user begins exercising.

Store:
- Workout information.
- Exercises included in the workout.
- Prescribed sets.
- Prescribed rep ranges.
- Prescribed weight.
- Target RIR.

Keep the prescribed values separate from actual performance.

### E. Save completed workouts

When the user finishes a workout, save:
- Workout completion status.
- Exercises performed.
- Actual weight used.
- Actual repetitions completed.
- Actual RIR.
- Whether each set was completed.
- Relevant workout notes.

**Important:** Individual set results must be saved. The progression system needs this information to learn from the user's performance.

### F. Save progression state

The progression system returns its complete state using:

```python
progression_system.export_state()
```

Save this state so it can be loaded the next time the user generates a workout.

The required ownership is:

| Data | Ownership |
|---|---|
| Global progression model | One per user |
| Local progression model | One per user, containing exercise-specific states |
| Workout history | One per user |
| Set results | Associated with the user's workout |

For the initial implementation, save the complete global and local model states as JSONB. Individual local exercise states can be separated later if necessary.

### G. Prevent duplicate processing

Make sure submitting the same completed workout twice does not update the progression models twice.

Only process progression after a workout has been confirmed as completed.

Save the updated progression state and split rotation consistently with workout completion processing.

---

## 2. Python services: What needs to be connected

The Python implementation should remain database-independent.

The database/backend layer calls the existing Python functions.

| File | Required responsibility |
|---|---|
| `global_progression_model.py` | Maintain the user's global progression model |
| `local_progression_model.py` | Maintain local exercise models and coordinate progression updates |
| `progression_adapter.py` | Apply recommendations to generated exercises |
| `workout_generator.py` | Generate workouts using database-provided exercise records |

Required integration methods:

```python
# Initialize progression using previously saved state.
progression_system = ProgressionSystem(
    state_data=saved_state
)

# Initialize an exercise if it has no local model.
progression_system.initialize_exercise(
    exercise_id,
    starting_prescription
)

# Generate a recommendation.
recommendation = progression_system.recommend(
    exercise_id,
    current_prescription
)

# Apply recommendations to generated workouts.
apply_recommendations_to_program(
    workouts,
    recommendations
)

# Update progression after an exercise is completed.
progression_system.record_completed_exercise(
    observation
)

# Export updated state for database persistence.
updated_state = progression_system.export_state()
```

**Important:** Do not separately update the global model. `record_completed_exercise()` already updates both the local and global models.

---

## 3. Required workflow

### Generating a workout

1. Authenticate the user.
2. Retrieve their profile and workout preferences.
3. Retrieve eligible exercises.
4. Load their saved global and local progression state.
5. Generate the workout.
6. Initialize any new exercises.
7. Apply progression recommendations.
8. Save the finalized workout and prescribed exercises.
9. Return the workout to the application.

### Completing a workout

1. Retrieve the saved workout.
2. Save the actual exercise and set results.
3. Reconstruct an `ExerciseObservation` for each completed exercise.
4. Call `record_completed_exercise()` exactly once per observation.
5. Save the updated global and local progression state.
6. Advance and save split rotation.
7. Mark the workout as processed to prevent duplicate updates.

---

## 4. Expected result

Once integration is complete:

1. A user opens FORM and their workout preferences are retrieved.
2. FORM generates a workout using the exercise database and the user's progression history.
3. The generated workout and prescriptions are saved.
4. The user completes the workout and records their actual sets.
5. The actual results are saved.
6. The Bayesian progression models learn from the completed workout.
7. The updated progression state is saved.
8. The user's next workout uses their updated progression recommendations.

**Core principle:** Supabase stores the user's data and workout history. Python generates workouts and learns from completed performance. Neither system needs to own the other's responsibilities.

