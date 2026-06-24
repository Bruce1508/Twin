import { db } from "@/lib/db";

export async function GET() {
  try {
    const note = await db.tutorNote.findFirst({ orderBy: { createdAt: "desc" } });
    return Response.json({ note: note ?? { notes: "", homework: "", createdAt: null } });
  } catch (err) {
    console.error("Notes fetch failed:", err);
    return Response.json({ error: "DB error" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = request.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer tutor_")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { notes?: string; homework?: string };
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  try {
    const note = await db.tutorNote.create({
      data: { notes: body.notes ?? "", homework: body.homework ?? "" },
    });
    return Response.json({ note });
  } catch (err) {
    console.error("Notes save failed:", err);
    return Response.json({ error: "DB error" }, { status: 503 });
  }
}
