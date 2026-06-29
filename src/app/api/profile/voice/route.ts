import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { uploadVoiceIntroduction } from "@/lib/profile/service";

export async function POST(request: Request) {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    const formData = await request.formData();
    const file = formData.get("voice");
    const durationSeconds = Number(formData.get("durationSeconds"));

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Voice introduction audio is required." },
        { status: 400 },
      );
    }

    if (!Number.isFinite(durationSeconds)) {
      return NextResponse.json(
        { error: "Voice introduction duration is required." },
        { status: 400 },
      );
    }

    const quality = await uploadVoiceIntroduction({
      durationSeconds,
      file,
      ownedProfile: session.ownedProfile,
    });

    return NextResponse.json(quality, { status: 201 });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to upload voice introduction." },
      { status: 500 },
    );
  }
}
