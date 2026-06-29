import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { uploadProfilePhotos } from "@/lib/profile/service";

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
    const files = formData
      .getAll("photos")
      .filter((file): file is File => file instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "At least one profile photo is required." },
        { status: 400 },
      );
    }

    const quality = await uploadProfilePhotos(session.ownedProfile, files);

    return NextResponse.json(quality, { status: 201 });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to upload profile photos." },
      { status: 500 },
    );
  }
}
