import crypto from "crypto";

export function generateToken(passcode: string): string {
  const nonce = crypto.randomBytes(24).toString("base64url");
  const sig = crypto.createHmac("sha256", passcode).update(nonce).digest("base64url");
  return `tutor_${nonce}.${sig}`;
}

export function verifyToken(raw: string, passcode: string): boolean {
  if (!raw.startsWith("tutor_")) return false;
  const rest = raw.slice(6);
  const dot = rest.indexOf(".");
  if (dot === -1) return false;
  const nonce = rest.slice(0, dot);
  const sig = rest.slice(dot + 1);
  const expected = crypto.createHmac("sha256", passcode).update(nonce).digest("base64url");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(sig, "base64url"),
      Buffer.from(expected, "base64url")
    );
  } catch {
    return false;
  }
}

export function extractBearer(request: Request): string {
  const auth = request.headers.get("Authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}
