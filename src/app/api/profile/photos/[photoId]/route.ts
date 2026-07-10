import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import {
  deleteProfilePhoto,
  ProfileMediaUploadError,
  replaceProfilePhoto,
} from "@/lib/profile/service";

type ProfilePhotoContext = {
  params: Promise<{ photoId: string }>;
};

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

export async function PATCH(request: Request, context: ProfilePhotoContext) {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    const formData = await request.formData();
    const file = formData.get("photo");

    if (!isUploadedFile(file)) {
      return NextResponse.json(
        { error: "Choose a replacement profile photo." },
        { status: 400 },
      );
    }

    const { photoId } = await context.params;
    const quality = await replaceProfilePhoto({
      file,
      ownedProfile: session.ownedProfile,
      photoId,
    });

    return NextResponse.json(quality);
  } catch (error) {
    return photoErrorResponse(error, "Profile photo could not be replaced.");
  }
}

export async function DELETE(
  _request: Request,
  context: ProfilePhotoContext,
) {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    const { photoId } = await context.params;
    const quality = await deleteProfilePhoto({
      ownedProfile: session.ownedProfile,
      photoId,
    });

    return NextResponse.json(quality);
  } catch (error) {
    return photoErrorResponse(error, "Profile photo could not be deleted.");
  }
}

function photoErrorResponse(error: unknown, fallback: string) {
  if (error instanceof ProfileMediaUploadError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  return NextResponse.json({ error: fallback }, { status: 500 });
}
