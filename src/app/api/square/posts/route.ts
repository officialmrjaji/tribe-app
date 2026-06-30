import { NextResponse } from "next/server";
import { getSquareSession, squareErrorResponse } from "@/lib/square/api";
import { squarePostInputSchema } from "@/lib/square/schema";
import { createSquarePost } from "@/lib/square/service";

export async function POST(request: Request) {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const contentType = request.headers.get("content-type") ?? "";
    let imageFile: File | null = null;
    let payload: unknown;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const photo = formData.get("photo");
      imageFile = photo instanceof File && photo.size > 0 ? photo : null;
      payload = {
        body: String(formData.get("body") ?? ""),
        caption: String(formData.get("caption") ?? ""),
        isAnonymous: formData.get("isAnonymous") === "true",
        pollOptions: formData
          .getAll("pollOptions")
          .map((option) => String(option))
          .filter(Boolean),
        pollQuestion: String(formData.get("pollQuestion") ?? ""),
        postType: String(formData.get("postType") ?? "thought"),
        topics: String(formData.get("topics") ?? "")
          .split(",")
          .map((topic) => topic.trim())
          .filter(Boolean),
      };
    } else {
      payload = await request.json();
    }

    const parsedPayload = squarePostInputSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: "Invalid Square post payload.",
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    const post = await createSquarePost({
      imageFile,
      input: parsedPayload.data,
      ownedProfile: session.ownedProfile,
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    return squareErrorResponse(error, "Square post could not be created.");
  }
}
