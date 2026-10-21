-- 1. Body metrics
CREATE TABLE public.body_metrics (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    weight_kg DECIMAL NOT NULL,
    waist_cm DECIMAL,

    PRIMARY KEY (user_id, date)
);


-- 2. Readiness check-ins
CREATE TABLE public.readiness_checkins (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    sleep_h DECIMAL NOT NULL,
    soreness DECIMAL NOT NULL,
    stress DECIMAL NOT NULL,
    hrv_ms DECIMAL,

    PRIMARY KEY (user_id, date)
);