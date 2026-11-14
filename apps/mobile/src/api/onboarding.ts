// mock onboarding status. in memory so it resets on app reload (you start unfinished)
// TODO(onboarding): replace with a Supabase profile read/write; the real flag will come from profile data
// the signatures stay the same so hooks and screens won't need to change

let done = false;

export const onboarding = {
    async isComplete(): Promise<boolean> {
        return done;
    },

    async complete(): Promise<void> {
        done = true;
    },
};