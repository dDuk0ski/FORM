// shared by the mock and supabase onboarding services
export type OnboardingService = {
    isComplete(): Promise<boolean>;
    // throws if setup isn't actually finished
    complete(): Promise<void>;
};
