import "server-only";

import { db } from "@/lib/db";
import { TASK_TYPES, type TaskType } from "@/lib/extractor";
import { ClassroomAccessError, requireClassRole } from "@/lib/classroom-service";

const TITLE_MAX_LENGTH = 150;
const INSTRUCTIONS_MAX_LENGTH = 5000;
const TASK_TYPE_VALUES = new Set<string>(TASK_TYPES.map((item) => item.value));

export type AssignmentStatusName = "DRAFT" | "PUBLISHED" | "CLOSED";

export class AssignmentNotFoundError extends Error {}
export class AssignmentStateError extends Error {}

export function normalizeAssignmentTitle(value: unknown): string {
  if (typeof value !== "string") throw new Error("Assignment title is required");
  const title = value.trim().replace(/\s+/g, " ");
  if (!title || title.length > TITLE_MAX_LENGTH) throw new Error("Assignment title is invalid");
  return title;
}

export function normalizeAssignmentInstructions(value: unknown): string {
  if (typeof value !== "string") throw new Error("Assignment instructions are required");
  const instructions = value.trim();
  if (!instructions || instructions.length > INSTRUCTIONS_MAX_LENGTH) {
    throw new Error("Assignment instructions are invalid");
  }
  return instructions;
}

export function normalizeTaskType(value: unknown): TaskType {
  if (typeof value !== "string" || !TASK_TYPE_VALUES.has(value)) {
    throw new Error("Assignment task type is invalid");
  }
  return value as TaskType;
}

export function normalizeDueAt(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("Assignment due date is invalid");
  const dueAt = new Date(value);
  if (Number.isNaN(dueAt.getTime())) throw new Error("Assignment due date is invalid");
  return dueAt;
}

export function assertAssignmentTransition(
  current: AssignmentStatusName,
  next: AssignmentStatusName,
): void {
  const allowed = current === "DRAFT" && next === "PUBLISHED"
    || current === "PUBLISHED" && next === "CLOSED";
  if (!allowed) throw new AssignmentStateError(`Cannot move assignment from ${current} to ${next}`);
}

export async function createAssignment(
  userId: string,
  classroomId: string,
  input: { title: unknown; instructions: unknown; taskType: unknown; dueAt?: unknown },
) {
  await requireClassRole(userId, classroomId, ["TEACHER"]);
  return db.assignment.create({
    data: {
      classroomId,
      createdById: userId,
      title: normalizeAssignmentTitle(input.title),
      instructions: normalizeAssignmentInstructions(input.instructions),
      taskType: normalizeTaskType(input.taskType),
      dueAt: normalizeDueAt(input.dueAt),
    },
  });
}

export async function listAssignmentsForMember(userId: string, classroomId: string) {
  const membership = await requireClassRole(userId, classroomId, ["TEACHER", "STUDENT"]);
  if (membership.role === "TEACHER") {
    return db.assignment.findMany({
      where: { classroomId },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        instructions: true,
        taskType: true,
        dueAt: true,
        status: true,
        createdAt: true,
        _count: { select: { submissions: true } },
      },
    });
  }

  return db.assignment.findMany({
    where: {
      classroomId,
      status: { in: ["PUBLISHED", "CLOSED"] },
    },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      instructions: true,
      taskType: true,
      dueAt: true,
      status: true,
      createdAt: true,
    },
  });
}

export async function getAssignmentForMember(userId: string, assignmentId: string) {
  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      classroomId: true,
      title: true,
      instructions: true,
      taskType: true,
      dueAt: true,
      status: true,
      classroom: { select: { name: true } },
    },
  });
  if (!assignment) throw new AssignmentNotFoundError("Assignment not found");
  const membership = await requireClassRole(userId, assignment.classroomId, ["TEACHER", "STUDENT"]);
  if (membership.role === "STUDENT" && assignment.status === "DRAFT") {
    throw new ClassroomAccessError("Assignment access denied");
  }
  return { assignment, membership };
}

export async function transitionAssignment(
  userId: string,
  assignmentId: string,
  nextStatus: AssignmentStatusName,
) {
  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, classroomId: true, status: true },
  });
  if (!assignment) throw new AssignmentNotFoundError("Assignment not found");
  await requireClassRole(userId, assignment.classroomId, ["TEACHER"]);
  assertAssignmentTransition(assignment.status, nextStatus);
  return db.assignment.update({ where: { id: assignmentId }, data: { status: nextStatus } });
}

export async function updateDraftAssignment(
  userId: string,
  assignmentId: string,
  input: { title: unknown; instructions: unknown; taskType: unknown; dueAt?: unknown },
) {
  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, classroomId: true, status: true },
  });
  if (!assignment) throw new AssignmentNotFoundError("Assignment not found");
  await requireClassRole(userId, assignment.classroomId, ["TEACHER"]);
  if (assignment.status !== "DRAFT") {
    throw new AssignmentStateError("Only draft assignments can be edited");
  }
  const result = await db.assignment.updateMany({
    where: { id: assignmentId, status: "DRAFT" },
    data: {
      title: normalizeAssignmentTitle(input.title),
      instructions: normalizeAssignmentInstructions(input.instructions),
      taskType: normalizeTaskType(input.taskType),
      dueAt: normalizeDueAt(input.dueAt),
    },
  });
  if (result.count === 0) throw new AssignmentStateError("Only draft assignments can be edited");
  return db.assignment.findUniqueOrThrow({ where: { id: assignmentId } });
}
