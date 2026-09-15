import "server-only";

import { db } from "@/lib/db";
import {
  generateJoinCode,
  hasClassroomRole,
  normalizeClassroomName,
  normalizeJoinCode,
  type ClassroomRoleName,
} from "@/lib/classroom";

export class ClassroomNotFoundError extends Error {}
export class ClassroomAccessError extends Error {}
export class ClassroomConflictError extends Error {}

function isUniqueConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function withUniqueJoinCode<T>(operation: (joinCode: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await operation(generateJoinCode());
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
    }
  }
  throw new ClassroomConflictError("Unable to generate a unique join code");
}

export async function createClassroom(userId: string, rawName: unknown) {
  const name = normalizeClassroomName(rawName);
  return withUniqueJoinCode((joinCode) =>
    db.classroom.create({
      data: {
        name,
        joinCode,
        memberships: { create: { userId, role: "TEACHER" } },
      },
      include: { _count: { select: { memberships: true } } },
    }),
  );
}

export async function listUserClassrooms(userId: string) {
  return db.classroomMember.findMany({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    select: {
      role: true,
      joinedAt: true,
      classroom: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          _count: { select: { memberships: true } },
        },
      },
    },
  });
}

export async function joinClassroom(userId: string, rawCode: unknown) {
  const joinCode = normalizeJoinCode(rawCode);
  const classroom = await db.classroom.findUnique({
    where: { joinCode },
    select: { id: true, name: true },
  });
  if (!classroom) throw new ClassroomNotFoundError("Classroom not found");

  const membership = await db.classroomMember.upsert({
    where: { classroomId_userId: { classroomId: classroom.id, userId } },
    update: {},
    create: { classroomId: classroom.id, userId, role: "STUDENT" },
  });
  return { classroom, membership };
}

export async function requireClassRole(
  userId: string,
  classroomId: string,
  allowedRoles: readonly ClassroomRoleName[],
) {
  const membership = await db.classroomMember.findUnique({
    where: { classroomId_userId: { classroomId, userId } },
  });
  if (!membership || !hasClassroomRole(membership.role, allowedRoles)) {
    throw new ClassroomAccessError("Classroom access denied");
  }
  return membership;
}

export async function getClassroomOverview(userId: string, classroomId: string) {
  const membership = await requireClassRole(userId, classroomId, ["TEACHER", "STUDENT"]);
  if (membership.role === "TEACHER") {
    const classroom = await db.classroom.findUnique({
      where: { id: classroomId },
      include: {
        memberships: {
          orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!classroom) throw new ClassroomNotFoundError("Classroom not found");
    return { classroom, membership, isTeacher: true as const };
  }

  const classroom = await db.classroom.findUnique({
    where: { id: classroomId },
    select: { id: true, name: true, createdAt: true },
  });
  if (!classroom) throw new ClassroomNotFoundError("Classroom not found");
  return { classroom, membership, isTeacher: false as const };
}

export async function rotateClassroomJoinCode(userId: string, classroomId: string) {
  await requireClassRole(userId, classroomId, ["TEACHER"]);
  return withUniqueJoinCode((joinCode) =>
    db.classroom.update({ where: { id: classroomId }, data: { joinCode } }),
  );
}

export async function removeStudent(
  teacherId: string,
  classroomId: string,
  studentId: string,
) {
  await requireClassRole(teacherId, classroomId, ["TEACHER"]);
  const target = await db.classroomMember.findUnique({
    where: { classroomId_userId: { classroomId, userId: studentId } },
  });
  if (!target || target.role !== "STUDENT") {
    throw new ClassroomNotFoundError("Student membership not found");
  }
  return withUniqueJoinCode((joinCode) =>
    db.$transaction([
      db.classroomMember.delete({ where: { id: target.id } }),
      db.classroom.update({ where: { id: classroomId }, data: { joinCode } }),
    ]),
  );
}
