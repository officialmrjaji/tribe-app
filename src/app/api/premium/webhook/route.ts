import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/feature-flags";

type PaystackWebhookPayload = {
  data?: {
    reference?: string;
  };
  event?: string;
};

export async function POST(request: Request) {
  if (!isFeatureEnabled("premium") || !isFeatureEnabled("payments")) {
    return NextResponse.json({
      disabled: true,
      received: true,
      status: "coming_soon",
    });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  try {
    const [
      { verifyPaystackWebhookSignature },
      { verifyPremiumPurchaseByReference },
    ] = await Promise.all([
      import("@/lib/premium/paystack"),
      import("@/lib/premium/service"),
    ]);

    if (!verifyPaystackWebhookSignature({ rawBody, signature })) {
      return NextResponse.json(
        { error: "Invalid payment webhook signature." },
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

    const status = getServiceErrorStatus(error);

    if (status) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Premium error." },
        { status },
      );
    }

    return NextResponse.json(
      { error: "Unable to process Paystack webhook." },
      { status: 500 },
    );
  }
}

function getServiceErrorStatus(error: unknown) {
  return error &&
    typeof error === "object" &&
    "status" in error &&
    typeof error.status === "number"
    ? error.status
    : null;
}
