import crypto from "node:crypto";

const paystackBaseUrl = "https://api.paystack.co";

type PaystackInitializeResponse = {
  data?: {
    access_code?: string;
    authorization_url?: string;
    reference?: string;
  };
  message?: string;
  status?: boolean;
};

type PaystackVerifyResponse = {
  data?: {
    amount?: number;
    currency?: string;
    id?: number;
    metadata?: Record<string, unknown>;
    paid_at?: string | null;
    reference?: string;
    status?: string;
  };
  message?: string;
  status?: boolean;
};

export type PaystackVerifiedTransaction = {
  amountKobo: number;
  currency: string;
  metadata: Record<string, unknown>;
  paidAt: string | null;
  reference: string;
  status: string;
  transactionId: string | null;
};

export class PaystackError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "PaystackError";
    this.status = status;
  }
}

export async function initializePaystackTransaction({
  amountKobo,
  callbackUrl,
  email,
  metadata,
  reference,
}: {
  amountKobo: number;
  callbackUrl: string;
  email: string;
  metadata: Record<string, unknown>;
  reference: string;
}) {
  const response = await fetch(`${paystackBaseUrl}/transaction/initialize`, {
    body: JSON.stringify({
      amount: amountKobo,
      callback_url: callbackUrl,
      currency: "NGN",
      email,
      metadata,
      reference,
    }),
    headers: {
      Authorization: `Bearer ${getPaystackSecretKey()}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as
    | PaystackInitializeResponse
    | null;

  if (!response.ok || !payload?.status) {
    throw new PaystackError(
      payload?.message ?? "Paystack could not initialize checkout.",
      response.status || 502,
    );
  }

  const authorizationUrl = payload.data?.authorization_url;
  const accessCode = payload.data?.access_code;
  const paystackReference = payload.data?.reference;

  if (!authorizationUrl || !accessCode || !paystackReference) {
    throw new PaystackError("Paystack returned an incomplete checkout session.");
  }

  return {
    accessCode,
    authorizationUrl,
    reference: paystackReference,
  };
}

export async function verifyPaystackTransaction(reference: string) {
  const response = await fetch(
    `${paystackBaseUrl}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${getPaystackSecretKey()}`,
      },
      method: "GET",
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | PaystackVerifyResponse
    | null;

  if (!response.ok || !payload?.status) {
    throw new PaystackError(
      payload?.message ?? "Paystack could not verify this payment.",
      response.status || 502,
    );
  }

  const transaction = payload.data;

  if (!transaction?.reference) {
    throw new PaystackError("Paystack returned an incomplete verification.");
  }

  return {
    amountKobo: transaction.amount ?? 0,
    currency: transaction.currency ?? "NGN",
    metadata: transaction.metadata ?? {},
    paidAt: transaction.paid_at ?? null,
    reference: transaction.reference,
    status: transaction.status ?? "unknown",
    transactionId: transaction.id ? String(transaction.id) : null,
  } satisfies PaystackVerifiedTransaction;
}

export function verifyPaystackWebhookSignature({
  rawBody,
  signature,
}: {
  rawBody: string;
  signature: string | null;
}) {
  if (!signature) {
    return false;
  }

  const expected = crypto
    .createHmac("sha512", getPaystackSecretKey())
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  return (
    expectedBuffer.length === signatureBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

function getPaystackSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();

  if (!key) {
    throw new PaystackError(
      "PAYSTACK_SECRET_KEY is required before Tribe Premium checkout can run.",
      500,
    );
  }

  return key;
}
