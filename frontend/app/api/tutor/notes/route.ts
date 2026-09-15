import { db } from "@/lib/db";
import { verifyToken, extractBearer } from "@/lib/tutor-auth";

function authorized(request: Request): boolean {
  const passcode = process.env.TUTOR_PASSCODE;
  if (!passcode) return false;
  return verifyToken(extractBearer(request), passcode);
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const note = await db.tutorNote.findFirst({ orderBy: { createdAt: "desc" } });
    return Response.json({ note: note ?? { notes: "", homework: "", createdAt: null } });
  } catch (err) {
    console.error("Notes fetch failed:", err);
    return Response.json({ error: "DB error" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { notes?: string; homework?: string };
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  if ((body.notes?.length ?? 0) > 10000 || (body.homework?.length ?? 0) > 5000) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }

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
