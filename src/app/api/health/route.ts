import { NextResponse } from "next/server";
import { getHealthStatus } from "@/lib/health/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getHealthStatus();

  return NextResponse.json(health, {
    status: health.status === "healthy" ? 200 : 503,
  });
}
