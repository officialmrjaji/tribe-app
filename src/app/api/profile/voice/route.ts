import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import {
  ProfileMediaUploadError,
  uploadVoiceIntroduction,
} from "@/lib/profile/service";

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function" &&
    "size" in value &&
    typeof value.size === "number" &&
    "type" in value &&
    typeof value.type === "string"
  );
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Voice upload must use multipart form data." },
        { status: 400 },
      );
    }

    const file = formData.get("voice");
    const durationSeconds = Number(formData.get("durationSeconds"));

    if (!isUploadedFile(file)) {
      return NextResponse.json(
        { error: "Choose a voice introduction audio file to upload." },
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

    if (error instanceof ProfileMediaUploadError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error:
          "Unable to upload voice introduction. Check profile media storage and try again.",
      },
      { status: 500 },
    );
  }
}
