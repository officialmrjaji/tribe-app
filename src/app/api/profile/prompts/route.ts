import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { saveProfilePrompts } from "@/lib/profile/service";

const profilePromptSchema = z.object({
  prompts: z.array(
    z.object({
      answer: z.string().trim().max(240),
      promptKey: z.enum([
        "perfect_weekend",
        "people_notice",
        "looking_for",
      ]),
    }),
  ),
});

export async function PATCH(request: Request) {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    const payload = await request.json();
    const parsedPayload = profilePromptSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: "Invalid profile prompts payload",
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    const quality = await saveProfilePrompts(
      session.ownedProfile,
      parsedPayload.data.prompts,
    );

    return NextResponse.json(quality);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to save profile prompts." },
      { status: 500 },
    );
  }
}
