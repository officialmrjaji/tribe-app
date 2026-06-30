import { NextResponse } from "next/server";
import {
  verifyPaystackWebhookSignature,
  PaystackError,
} from "@/lib/premium/paystack";
import {
  PremiumError,
  verifyPremiumPurchaseByReference,
} from "@/lib/premium/service";

type PaystackWebhookPayload = {
  data?: {
    reference?: string;
  };
  event?: string;
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  try {
    if (!verifyPaystackWebhookSignature({ rawBody, signature })) {
      return NextResponse.json(
        { error: "Invalid Paystack webhook signature." },
        { status: 401 },
      );
    }

    const payload = JSON.parse(rawBody) as PaystackWebhookPayload;

    if (payload.event !== "charge.success") {
      return NextResponse.json({ received: true });
    }

    const reference = payload.data?.reference;

    if (!reference) {
      return NextResponse.json(
        { error: "Webhook payment reference is missing." },
        { status: 400 },
      );
    }

    await verifyPremiumPurchaseByReference(reference);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(error);

    if (error instanceof PremiumError || error instanceof PaystackError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Unable to process Paystack webhook." },
      { status: 500 },
    );
  }
}
