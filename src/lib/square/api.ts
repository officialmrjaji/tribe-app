import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { SquareError } from "./service";

export async function getSquareSession() {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    return {
      response: NextResponse.json(
        { error: session.error },
        { status: session.status },
      ),
    };
  }

  return { ownedProfile: session.ownedProfile };
}

export function squareErrorResponse(error: unknown, fallback: string) {
  if (error instanceof SquareError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 },
  );
}
