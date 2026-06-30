import { Crown, Zap } from "lucide-react";

type PremiumBadgeProps = {
  boost?: boolean;
  compact?: boolean;
  label?: string | null;
};

export function PremiumBadge({
  boost = false,
  compact = false,
  label,
}: PremiumBadgeProps) {
  const Icon = boost ? Zap : Crown;
  const text = label ?? (boost ? "Boost active" : "Tribe Plus");

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#f6c66f] px-2 py-1 text-xs font-bold text-[#17201b]">
      <Icon size={13} aria-hidden="true" />
      {compact ? text.replace("Tribe ", "") : text}
    </span>
  );
}
