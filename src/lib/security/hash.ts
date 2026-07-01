import { createHash } from "node:crypto";

export function hashValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return createHash("sha256").update(value).digest("hex");
}
