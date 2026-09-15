import { getCurrentUser } from "@/lib/current-user";
import { ClassroomAccessError } from "@/lib/classroom-service";
import {
  createAssignment,
  listAssignmentsForMember,
  normalizeAssignmentInstructions,
  normalizeAssignmentTitle,
  normalizeDueAt,
  normalizeTaskType,
} from "@/lib/assignments";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  try {
    const { classId } = await params;
    return Response.json({ assignments: await listAssignmentsForMember(user.id, classId) });
  } catch (error) {
    const status = error instanceof ClassroomAccessError ? 403 : 500;
    return Response.json({ error: status === 403 ? "Classroom access denied" : "Unable to list assignments" }, { status });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

  let input;
  try {
    const body = await request.json();
    input = {
      title: normalizeAssignmentTitle(body.title),
      instructions: normalizeAssignmentInstructions(body.instructions),
      taskType: normalizeTaskType(body.taskType),
      dueAt: normalizeDueAt(body.dueAt),
    };
  } catch {
    return Response.json({ error: "Assignment details are invalid" }, { status: 400 });
  }

  try {
    const { classId } = await params;
    const assignment = await createAssignment(user.id, classId, input);
    return Response.json({ assignment }, { status: 201 });
  } catch (error) {
    if (error instanceof ClassroomAccessError) {
      return Response.json({ error: "Classroom access denied" }, { status: 403 });
    }
    return Response.json({ error: "Unable to create assignment" }, { status: 500 });
  }
}
