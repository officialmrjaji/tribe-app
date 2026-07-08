import { NextResponse } from "next/server";
import { aiConversationCoachInputSchema } from "@/lib/ai/schema";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { disabledFeatureResponse } from "@/lib/feature-response";

export async function POST(request: Request) {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    if (!isFeatureEnabled("ai")) {
      return disabledFeatureResponse("ai");
    }

    const parsedPayload = aiConversationCoachInputSchema.safeParse(
      await request.json(),
    );

    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: "Invalid conversation coach payload.",
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    const { generateConversationCoachSuggestions } = await import(
      "@/lib/ai/service"
    );
    const result = await generateConversationCoachSuggestions({
      input: parsedPayload.data,
      ownedProfile: session.ownedProfile,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);

    const status = getServiceErrorStatus(error);

    if (status) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "AI Companion error." },
        { status },
      );
    }

    return NextResponse.json(
      { error: "Unable to generate conversation suggestions." },
      { status: 500 },
    );
  }
}

function getServiceErrorStatus(error: unknown) {
  return error &&
    typeof error === "object" &&
    "status" in error &&
    typeof error.status === "number"
    ? error.status
    : null;
}
