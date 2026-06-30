import { BadgeCheck, MailCheck, Phone, ShieldCheck } from "lucide-react";
import type { ProfileVerification } from "@/lib/profile/service";

type VerificationBadgesProps = {
  compact?: boolean;
  verification: ProfileVerification;
};

const badgeConfig = [
  {
    key: "email",
    icon: MailCheck,
    label: "Email verified",
  },
  {
    key: "phone",
    icon: Phone,
    label: "Phone verified",
  },
  {
    key: "identity",
    icon: BadgeCheck,
    label: "Identity verified",
  },
] as const;

export function VerificationBadges({
  compact = false,
  verification,
}: VerificationBadgesProps) {
  const visibleBadges = badgeConfig.filter((badge) => verification[badge.key]);

  if (visibleBadges.length === 0) {
    return compact ? null : (
      <span className="inline-flex items-center gap-1 rounded-md border border-[#d8ded1] bg-white px-2 py-1 text-xs font-semibold text-[#607265]">
        <ShieldCheck size={13} />
        Verification pending
      </span>
    );
  }

  return (
    <>
      {visibleBadges.map((badge) => {
        const Icon = badge.icon;

        return (
          <span
            className="inline-flex items-center gap-1 rounded-md bg-[#edf2e9] px-2 py-1 text-xs font-semibold text-[#2f5f36]"
            key={badge.key}
          >
            <Icon size={13} aria-hidden="true" />
            {compact ? badge.label.replace(" verified", "") : badge.label}
          </span>
        );
      })}
    </>
  );
}
