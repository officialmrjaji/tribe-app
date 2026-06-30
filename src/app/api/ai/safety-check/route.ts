import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { OpenAIServiceError } from "@/lib/ai/openai";
import { aiSafetyCheckInputSchema } from "@/lib/ai/schema";
import {
  AICompanionError,
  runAISafetyCheck,
} from "@/lib/ai/service";

export async function POST(request: Request) {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    const parsedPayload = aiSafetyCheckInputSchema.safeParse(
      await request.json(),
    );

    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: "Invalid safety check payload.",
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    const result = await runAISafetyCheck({
      input: parsedPayload.data,
      ownedProfile: session.ownedProfile,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);

    if (error instanceof AICompanionError || error instanceof OpenAIServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Unable to run safety check." },
      { status: 500 },
    );
  }
}
