import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import {
  ProfileMediaUploadError,
  uploadProfilePhotos,
} from "@/lib/profile/service";

function isUploadedFile(value: FormDataEntryValue): value is File {
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
        { error: "Photo upload must use multipart form data." },
        { status: 400 },
      );
    }

    const files = formData.getAll("photos").filter(isUploadedFile);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Choose at least one profile photo to upload." },
        { status: 400 },
      );
    }

    const quality = await uploadProfilePhotos(session.ownedProfile, files);

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
          "Unable to upload profile photos. Check profile media storage and try again.",
      },
      { status: 500 },
    );
  }
}
