import { getNextTarget } from "@/lib/targeting";
import { db } from "@/lib/db";

export async function GET() {
  const userId = process.env.DEV_USER_ID;
  if (!userId) return Response.json({ errorTag: null });

  try {
    const errorTag = await getNextTarget(userId);
    if (!errorTag) return Response.json({ errorTag: null });

    // Pass the most recent ErrorEvent id for this tag so the drill can set sourceErrorId
    const sourceError = await db.errorEvent.findFirst({
      where: { submission: { userId }, errorTag },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    return Response.json({ errorTag, sourceErrorId: sourceError?.id ?? null });
  } catch {
    return Response.json({ errorTag: null });
  }
}
