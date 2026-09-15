import { recomputeProfile } from "@/lib/profile";
import { getCurrentUser } from "@/lib/current-user";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const userId = user.id;
  try {
    await recomputeProfile(userId);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Profile recompute failed:", err);
    return Response.json({ error: "Recompute failed" }, { status: 500 });
  }
}
