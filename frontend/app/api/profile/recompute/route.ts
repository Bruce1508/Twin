import { recomputeProfile } from "@/lib/profile";

export async function POST() {
  const userId = process.env.DEV_USER_ID;
  if (!userId) {
    return Response.json({ error: "DEV_USER_ID not configured" }, { status: 503 });
  }
  try {
    await recomputeProfile(userId);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Profile recompute failed:", err);
    return Response.json({ error: "Recompute failed" }, { status: 500 });
  }
}
