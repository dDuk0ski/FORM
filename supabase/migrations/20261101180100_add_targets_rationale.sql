-- The one line the model shows under the targets, e.g.
-- "Weight trend fell 0.6 kg over 28 days on 2,140 kcal average."
ALTER TABLE public.targets
ADD COLUMN rationale TEXT;
