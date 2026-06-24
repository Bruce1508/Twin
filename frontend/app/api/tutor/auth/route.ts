export async function POST(request: Request) {
  const passcode = process.env.TUTOR_PASSCODE;
  if (!passcode) return Response.json({ error: "TUTOR_PASSCODE not configured" }, { status: 503 });

  let body: { passcode?: string };
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (body.passcode !== passcode) {
    return Response.json({ error: "Incorrect passcode" }, { status: 401 });
  }

  const token = `tutor_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return Response.json({ token });
}
