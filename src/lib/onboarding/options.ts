export const intentValues = [
  "friends",
  "networking",
  "dating",
  "activity_partner",
  "language_exchange",
] as const;

export type Intent = (typeof intentValues)[number];

export const personalityTypeValues = [
  "introvert",
  "ambivert",
  "extrovert",
] as const;

export type PersonalityType = (typeof personalityTypeValues)[number];

export const lifestyleSignalValues = [
  "morning_person",
  "night_owl",
  "low_key",
  "outdoors",
  "wellness",
  "creative",
  "learning",
  "community",
] as const;

export type LifestyleSignal = (typeof lifestyleSignalValues)[number];

export const interestValues = [
  "music",
  "art",
  "books",
  "fitness",
  "technology",
  "cooking",
  "travel",
  "languages",
  "volunteering",
  "film",
  "gaming",
  "hiking",
] as const;

export type Interest = (typeof interestValues)[number];

export const conversationStyleValues = [
  "deep_dives",
  "light_first",
  "voice_notes",
  "plan_oriented",
  "curiosity_led",
] as const;

export type ConversationStyle = (typeof conversationStyleValues)[number];

export const availabilityValues = [
  "weekday_mornings",
  "weeknights",
  "weekends",
  "spontaneous",
  "scheduled",
] as const;

export type Availability = (typeof availabilityValues)[number];

export const intentLabels: Record<Intent, string> = {
  activity_partner: "Activity partner",
  dating: "Dating",
  friends: "Friends",
  language_exchange: "Language exchange",
  networking: "Networking",
};

export const personalityTypeLabels: Record<PersonalityType, string> = {
  ambivert: "Ambivert",
  extrovert: "Extrovert",
  introvert: "Introvert",
};

export const lifestyleSignalLabels: Record<LifestyleSignal, string> = {
  community: "Community-minded",
  creative: "Creative rhythm",
  learning: "Always learning",
  low_key: "Low-key plans",
  morning_person: "Morning person",
  night_owl: "Night owl",
  outdoors: "Outdoors",
  wellness: "Wellness",
};

export const interestLabels: Record<Interest, string> = {
  art: "Art",
  books: "Books",
  cooking: "Cooking",
  film: "Film",
  fitness: "Fitness",
  gaming: "Gaming",
  hiking: "Hiking",
  languages: "Languages",
  music: "Music",
  technology: "Technology",
  travel: "Travel",
  volunteering: "Volunteering",
};

export const conversationStyleLabels: Record<ConversationStyle, string> = {
  curiosity_led: "Curiosity-led",
  deep_dives: "Deep dives",
  light_first: "Light first",
  plan_oriented: "Plan-oriented",
  voice_notes: "Voice notes",
};

export const availabilityLabels: Record<Availability, string> = {
  scheduled: "Scheduled in advance",
  spontaneous: "Spontaneous",
  weekday_mornings: "Weekday mornings",
  weeknights: "Weeknights",
  weekends: "Weekends",
};

export const intentOptions = intentValues.map((value) => ({
  label: intentLabels[value],
  value,
}));

export const personalityTypeOptions = personalityTypeValues.map((value) => ({
  label: personalityTypeLabels[value],
  value,
}));

export const lifestyleSignalOptions = lifestyleSignalValues.map((value) => ({
  label: lifestyleSignalLabels[value],
  value,
}));

export const interestOptions = interestValues.map((value) => ({
  label: interestLabels[value],
  value,
}));

export const conversationStyleOptions = conversationStyleValues.map((value) => ({
  label: conversationStyleLabels[value],
  value,
}));

export const availabilityOptions = availabilityValues.map((value) => ({
  label: availabilityLabels[value],
  value,
}));
