import { generateToken } from "@/lib/tutor-auth";

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const passcode = process.env.TUTOR_PASSCODE;
  if (!passcode) return Response.json({ error: "TUTOR_PASSCODE not configured" }, { status: 503 });

  let body: { passcode?: string };
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (body.passcode !== passcode) {
    return Response.json({ error: "Incorrect passcode" }, { status: 401 });
  }

  return Response.json({ token: generateToken(passcode) });
}
