import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import {
  initializePremiumCheckout,
  PremiumError,
} from "@/lib/premium/service";
import { PaystackError } from "@/lib/premium/paystack";

const checkoutSchema = z.object({
  planCode: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    const payload = checkoutSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        {
          error: "Invalid checkout payload.",
          issues: payload.error.issues,
        },
        { status: 400 },
      );
    }

    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    const checkout = await initializePremiumCheckout({
      origin,
      ownedProfile: session.ownedProfile,
      planCode: payload.data.planCode,
    });

    return NextResponse.json(checkout, { status: 201 });
  } catch (error) {
    console.error(error);

    if (error instanceof PremiumError || error instanceof PaystackError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Unable to start Tribe Premium checkout." },
      { status: 500 },
    );
  }
}
