import { getNextTarget } from "@/lib/targeting";
import { getCurrentUser } from "@/lib/current-user";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const userId = user.id;

  try {
    const errorTag = await getNextTarget(userId);
    if (!errorTag) return Response.json({ errorTag: null });

    return Response.json({ errorTag });
  } catch {
    return Response.json({ errorTag: null });
  }
}
