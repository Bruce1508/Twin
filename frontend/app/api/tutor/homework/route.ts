import { db } from "@/lib/db";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ homework: "", updatedAt: null });
  }
  try {
    const note = await db.tutorNote.findFirst({
      orderBy: { createdAt: "desc" },
      select: { homework: true, createdAt: true },
    });
    return Response.json({ homework: note?.homework ?? "", updatedAt: note?.createdAt ?? null });
  } catch {
    return Response.json({ homework: "", updatedAt: null });
  }
}
