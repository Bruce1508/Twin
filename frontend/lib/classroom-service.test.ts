import { afterEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  classroom: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  classroomMember: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  ClassroomAccessError,
  createClassroom,
  getClassroomOverview,
  joinClassroom,
  listUserClassrooms,
  removeStudent,
  requireClassRole,
  rotateClassroomJoinCode,
} from "@/lib/classroom-service";

describe("classroom authorization", () => {
  afterEach(() => vi.resetAllMocks());

  it("rejects a student from a teacher-only action", async () => {
    dbMock.classroomMember.findUnique.mockResolvedValue({ role: "STUDENT" });

    await expect(requireClassRole("student-1", "class-1", ["TEACHER"]))
      .rejects.toBeInstanceOf(ClassroomAccessError);
  });

  it("rejects a user without membership", async () => {
    dbMock.classroomMember.findUnique.mockResolvedValue(null);

    await expect(requireClassRole("outsider-1", "class-1", ["TEACHER", "STUDENT"]))
      .rejects.toBeInstanceOf(ClassroomAccessError);
  });

  it("does not load the roster for a student", async () => {
    dbMock.classroomMember.findUnique.mockResolvedValue({ role: "STUDENT" });
    dbMock.classroom.findUnique.mockResolvedValue({ id: "class-1", name: "Français B2" });

    const result = await getClassroomOverview("student-1", "class-1");

    expect(result.isTeacher).toBe(false);
    expect(dbMock.classroom.findUnique).toHaveBeenCalledWith({
      where: { id: "class-1" },
      select: { id: true, name: true, createdAt: true },
    });
  });

  it("keeps an existing role unchanged when joining twice", async () => {
    dbMock.classroom.findUnique.mockResolvedValue({ id: "class-1", name: "Français B2" });
    dbMock.classroomMember.upsert.mockResolvedValue({ role: "TEACHER" });

    await joinClassroom("teacher-1", "ABCDEFGHJK");

    expect(dbMock.classroomMember.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {} }));
  });

  it("creates the teacher membership atomically with the classroom", async () => {
    dbMock.classroom.create.mockResolvedValue({ id: "class-1" });

    await createClassroom("teacher-1", "Français B2");

    expect(dbMock.classroom.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: "Français B2",
        memberships: { create: { userId: "teacher-1", role: "TEACHER" } },
      }),
    }));
  });

  it("omits join codes from the class list projection", async () => {
    dbMock.classroomMember.findMany.mockResolvedValue([]);

    await listUserClassrooms("student-1");

    const query = dbMock.classroomMember.findMany.mock.calls[0][0];
    expect(query.select.classroom.select.joinCode).toBeUndefined();
  });

  it("does not rotate a join code for a student", async () => {
    dbMock.classroomMember.findUnique.mockResolvedValue({ role: "STUDENT" });

    await expect(rotateClassroomJoinCode("student-1", "class-1"))
      .rejects.toBeInstanceOf(ClassroomAccessError);
    expect(dbMock.classroom.update).not.toHaveBeenCalled();
  });

  it("rotates the join code in the same transaction that removes a student", async () => {
    dbMock.classroomMember.findUnique
      .mockResolvedValueOnce({ role: "TEACHER" })
      .mockResolvedValueOnce({ id: "membership-1", role: "STUDENT" });
    dbMock.classroomMember.delete.mockResolvedValue({ id: "membership-1" });
    dbMock.classroom.update.mockResolvedValue({ id: "class-1" });

    await removeStudent("teacher-1", "class-1", "student-1");

    expect(dbMock.$transaction).toHaveBeenCalledOnce();
    expect(dbMock.classroomMember.delete).toHaveBeenCalledWith({ where: { id: "membership-1" } });
    expect(dbMock.classroom.update).toHaveBeenCalledWith({
      where: { id: "class-1" },
      data: { joinCode: expect.any(String) },
    });
  });
});
