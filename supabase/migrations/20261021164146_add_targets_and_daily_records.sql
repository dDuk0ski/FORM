CREATE TABLE public.targets (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    effective_date DATE NOT NULL,
    kcal INTEGER,
    protein_g DECIMAL,
    carb_g DECIMAL,
    fat_g DECIMAL,
    tdee_estimate DECIMAL,
    source VARCHAR,

    PRIMARY KEY (user_id, effective_date)
);

CREATE TABLE public.daily_records (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    kcal_in INTEGER,
    protein DECIMAL,
    carb DECIMAL,
    fat DECIMAL,
    trend_weight_kg DECIMAL,
    training_load DECIMAL,
    readiness DECIMAL,
    tdee_estimate DECIMAL,
    log_quality DECIMAL,

    PRIMARY KEY (user_id, date)
);