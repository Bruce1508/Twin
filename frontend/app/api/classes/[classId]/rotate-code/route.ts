import { getCurrentUser } from "@/lib/current-user";
import { ClassroomAccessError, rotateClassroomJoinCode } from "@/lib/classroom-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

  try {
    const { classId } = await params;
    const classroom = await rotateClassroomJoinCode(user.id, classId);
    return Response.json({ joinCode: classroom.joinCode });
  } catch (error) {
    if (error instanceof ClassroomAccessError) {
      return Response.json({ error: "Classroom access denied" }, { status: 403 });
    }
    return Response.json({ error: "Unable to rotate join code" }, { status: 500 });
  }
}
