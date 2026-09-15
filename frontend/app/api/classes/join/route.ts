import { getCurrentUser } from "@/lib/current-user";
import { ClassroomNotFoundError, joinClassroom } from "@/lib/classroom-service";
import { normalizeJoinCode } from "@/lib/classroom";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

  let joinCode: string;
  try {
    const body = await request.json();
    joinCode = normalizeJoinCode(body.joinCode);
  } catch {
    return Response.json({ error: "Join code is invalid" }, { status: 400 });
  }

  try {
    const result = await joinClassroom(user.id, joinCode);
    return Response.json(result);
  } catch (error) {
    if (error instanceof ClassroomNotFoundError) {
      return Response.json({ error: "Classroom not found" }, { status: 404 });
    }
    return Response.json({ error: "Unable to join classroom" }, { status: 500 });
  }
}
