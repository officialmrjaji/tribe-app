import { NextResponse } from "next/server";
import {
  getFeatureFlag,
  type FeatureFlagKey,
} from "@/lib/feature-flags";

export function disabledFeatureResponse(key: FeatureFlagKey, status = 503) {
  const feature = getFeatureFlag(key);

  return NextResponse.json(
    {
      code: `${key}_coming_soon`,
      error: feature.description,
      feature: feature.label,
      status: "coming_soon",
    },
    { status },
  );
}
