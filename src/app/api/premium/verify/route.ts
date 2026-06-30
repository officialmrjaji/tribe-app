import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import {
  PremiumError,
  verifyPremiumPurchaseForUser,
} from "@/lib/premium/service";
import { PaystackError } from "@/lib/premium/paystack";

const verifySchema = z.object({
  reference: z.string().min(1),
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

    const payload = verifySchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        {
          error: "Payment reference is required.",
          issues: payload.error.issues,
        },
        { status: 400 },
      );
    }

    const result = await verifyPremiumPurchaseForUser({
      ownedProfile: session.ownedProfile,
      reference: payload.data.reference,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);

    if (error instanceof PremiumError || error instanceof PaystackError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Unable to verify Tribe Premium payment." },
      { status: 500 },
    );
  }
}
