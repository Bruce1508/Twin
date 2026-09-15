import { getCurrentUser } from "@/lib/current-user";
import { ClassroomAccessError } from "@/lib/classroom-service";
import {
  AssignmentNotFoundError,
  AssignmentStateError,
  normalizeAssignmentInstructions,
  normalizeAssignmentTitle,
  normalizeDueAt,
  normalizeTaskType,
  transitionAssignment,
  updateDraftAssignment,
  type AssignmentStatusName,
} from "@/lib/assignments";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    const value: unknown = await request.json();
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error();
    body = value as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Assignment details are invalid" }, { status: 400 });
  }

  let operation:
    | { kind: "transition"; status: AssignmentStatusName }
    | { kind: "edit"; input: { title: string; instructions: string; taskType: string; dueAt: Date | null } };
  if ("status" in body) {
    if (body.status !== "PUBLISHED" && body.status !== "CLOSED") {
      return Response.json({ error: "Assignment status is invalid" }, { status: 400 });
    }
    operation = { kind: "transition", status: body.status };
  } else {
    try {
      operation = {
        kind: "edit",
        input: {
          title: normalizeAssignmentTitle(body.title),
          instructions: normalizeAssignmentInstructions(body.instructions),
          taskType: normalizeTaskType(body.taskType),
          dueAt: normalizeDueAt(body.dueAt),
        },
      };
    } catch {
      return Response.json({ error: "Assignment details are invalid" }, { status: 400 });
    }
  }

  try {
    const { assignmentId } = await params;
    const assignment = operation.kind === "transition"
      ? await transitionAssignment(user.id, assignmentId, operation.status)
      : await updateDraftAssignment(user.id, assignmentId, operation.input);
    return Response.json({ assignment });
  } catch (error) {
    if (error instanceof AssignmentNotFoundError) {
      return Response.json({ error: "Assignment not found" }, { status: 404 });
    }
    if (error instanceof ClassroomAccessError) {
      return Response.json({ error: "Classroom access denied" }, { status: 403 });
    }
    if (error instanceof AssignmentStateError) {
      return Response.json({ error: "Assignment transition is invalid" }, { status: 409 });
    }
    return Response.json({ error: "Unable to update assignment" }, { status: 500 });
  }
}
