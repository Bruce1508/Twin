import { getCurrentUser } from "@/lib/current-user";
import {
  ClassroomAccessError,
  ClassroomNotFoundError,
  removeStudent,
} from "@/lib/classroom-service";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ classId: string; userId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

  try {
    const { classId, userId } = await params;
    await removeStudent(user.id, classId, userId);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ClassroomAccessError) {
      return Response.json({ error: "Classroom access denied" }, { status: 403 });
    }
    if (error instanceof ClassroomNotFoundError) {
      return Response.json({ error: "Student membership not found" }, { status: 404 });
    }
    return Response.json({ error: "Unable to remove student" }, { status: 500 });
  }
}
