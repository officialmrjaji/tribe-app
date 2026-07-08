export type FeatureFlagKey =
  | "ai"
  | "analytics"
  | "communities"
  | "events"
  | "payments"
  | "premium"
  | "square"
  | "voice";

type FeatureFlagDefinition = {
  badgeLabel: string;
  bullets: string[];
  defaultEnabled: boolean;
  description: string;
  env: string;
  label: string;
  title: string;
};

export type FeatureFlagState = FeatureFlagDefinition & {
  enabled: boolean;
  key: FeatureFlagKey;
};

const featureDefinitions: Record<FeatureFlagKey, FeatureFlagDefinition> = {
  ai: {
    badgeLabel: "Beta Coming Soon",
    bullets: [
      "Improve your profile",
      "Get conversation starters",
      "Receive better match explanations",
      "Stay safer with AI-powered moderation assistance",
    ],
    defaultEnabled: false,
    description:
      "Our AI Companion is almost ready. We are polishing it before private beta members can use it.",
    env: "AI_ENABLED",
    label: "AI Companion",
    title: "AI Companion is coming soon.",
  },
  analytics: {
    badgeLabel: "Enabled",
    bullets: [],
    defaultEnabled: true,
    description: "Product analytics foundation is active.",
    env: "ANALYTICS_ENABLED",
    label: "Analytics",
    title: "Analytics",
  },
  communities: {
    badgeLabel: "Coming Soon",
    bullets: [],
    defaultEnabled: false,
    description: "Communities are planned for a later release.",
    env: "COMMUNITIES_ENABLED",
    label: "Communities",
    title: "Communities are coming soon.",
  },
  events: {
    badgeLabel: "Coming Soon",
    bullets: [],
    defaultEnabled: false,
    description: "Events are planned for a later release.",
    env: "EVENTS_ENABLED",
    label: "Events",
    title: "Events are coming soon.",
  },
  payments: {
    badgeLabel: "Coming Soon",
    bullets: [
      "Secure checkout",
      "Subscription management",
      "Purchase restoration",
    ],
    defaultEnabled: false,
    description:
      "Payment actions are paused until checkout configuration is complete.",
    env: "PAYMENTS_ENABLED",
    label: "Payments",
    title: "Payments are coming soon.",
  },
  premium: {
    badgeLabel: "Coming Soon",
    bullets: [
      "See who liked you",
      "Advanced filters",
      "Profile boosts",
      "Unlimited undo",
      "Profile insights",
      "Incognito mode",
    ],
    defaultEnabled: false,
    description:
      "Premium memberships are almost here. Plans are visible for preview while purchase actions are paused.",
    env: "PREMIUM_ENABLED",
    label: "Tribe Plus",
    title: "Premium memberships are almost here.",
  },
  square: {
    badgeLabel: "Enabled",
    bullets: [],
    defaultEnabled: true,
    description: "Square is active.",
    env: "SQUARE_ENABLED",
    label: "Square",
    title: "Square",
  },
  voice: {
    badgeLabel: "Enabled",
    bullets: [],
    defaultEnabled: true,
    description: "Voice Rooms are active.",
    env: "VOICE_ENABLED",
    label: "Voice Rooms",
    title: "Voice Rooms",
  },
};

export function getFeatureFlag(key: FeatureFlagKey): FeatureFlagState {
  const definition = featureDefinitions[key];

  return {
    ...definition,
    enabled: parseBooleanFlag(process.env[definition.env], definition.defaultEnabled),
    key,
  };
}

export function getFeatureFlags() {
  return Object.fromEntries(
    (Object.keys(featureDefinitions) as FeatureFlagKey[]).map((key) => [
      key,
      getFeatureFlag(key),
    ]),
  ) as Record<FeatureFlagKey, FeatureFlagState>;
}

export function isFeatureEnabled(key: FeatureFlagKey) {
  return getFeatureFlag(key).enabled;
}

export function getFeatureUnavailableMessage(key: FeatureFlagKey) {
  return getFeatureFlag(key).description;
}

function parseBooleanFlag(value: string | undefined, fallback: boolean) {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  return ["1", "enabled", "on", "true", "yes"].includes(
    value.trim().toLowerCase(),
  );
}
