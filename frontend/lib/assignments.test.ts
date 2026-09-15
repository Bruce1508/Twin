import { afterEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  assignment: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  classroomMember: { findUnique: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  AssignmentStateError,
  assertAssignmentTransition,
  createAssignment,
  listAssignmentsForMember,
  normalizeAssignmentInstructions,
  normalizeAssignmentTitle,
  normalizeDueAt,
  normalizeTaskType,
  updateDraftAssignment,
} from "@/lib/assignments";

describe("assignment rules", () => {
  afterEach(() => vi.resetAllMocks());

  it("normalizes valid assignment input", () => {
    expect(normalizeAssignmentTitle("  Lettre   formelle ")).toBe("Lettre formelle");
    expect(normalizeAssignmentInstructions("  Écrivez 200 mots.  ")).toBe("Écrivez 200 mots.");
    expect(normalizeTaskType("formal_letter")).toBe("formal_letter");
    expect(normalizeDueAt(null)).toBeNull();
  });

  it("rejects invalid task types and dates", () => {
    expect(() => normalizeTaskType("speaking")).toThrow();
    expect(() => normalizeDueAt("not-a-date")).toThrow();
  });

  it("allows only draft to published and published to closed", () => {
    expect(() => assertAssignmentTransition("DRAFT", "PUBLISHED")).not.toThrow();
    expect(() => assertAssignmentTransition("PUBLISHED", "CLOSED")).not.toThrow();
    expect(() => assertAssignmentTransition("DRAFT", "CLOSED")).toThrow(AssignmentStateError);
    expect(() => assertAssignmentTransition("CLOSED", "PUBLISHED")).toThrow(AssignmentStateError);
  });

  it("requires teacher membership before creating", async () => {
    dbMock.classroomMember.findUnique.mockResolvedValue({ role: "STUDENT" });
    await expect(createAssignment("student-1", "class-1", {
      title: "Sujet",
      instructions: "Écrivez un texte.",
      taskType: "free_writing",
    })).rejects.toThrow();
    expect(dbMock.assignment.create).not.toHaveBeenCalled();
  });

  it("filters drafts out of the student list", async () => {
    dbMock.classroomMember.findUnique.mockResolvedValue({ role: "STUDENT" });
    dbMock.assignment.findMany.mockResolvedValue([]);
    await listAssignmentsForMember("student-1", "class-1");
    const query = dbMock.assignment.findMany.mock.calls[0][0];
    expect(query).toEqual(expect.objectContaining({
      where: { classroomId: "class-1", status: { in: ["PUBLISHED", "CLOSED"] } },
    }));
    expect(query.select._count).toBeUndefined();
  });

  it("lets teachers list drafts", async () => {
    dbMock.classroomMember.findUnique.mockResolvedValue({ role: "TEACHER" });
    dbMock.assignment.findMany.mockResolvedValue([]);
    await listAssignmentsForMember("teacher-1", "class-1");
    const query = dbMock.assignment.findMany.mock.calls[0][0];
    expect(query).toEqual(expect.objectContaining({
      where: { classroomId: "class-1" },
    }));
    expect(query.select._count).toEqual({ select: { submissions: true } });
  });

  it("prevents editing after publication", async () => {
    dbMock.assignment.findUnique.mockResolvedValue({ id: "assignment-1", classroomId: "class-1", status: "PUBLISHED" });
    dbMock.classroomMember.findUnique.mockResolvedValue({ role: "TEACHER" });

    await expect(updateDraftAssignment("teacher-1", "assignment-1", {
      title: "Titre",
      instructions: "Consigne",
      taskType: "free_writing",
    })).rejects.toThrow(AssignmentStateError);
    expect(dbMock.assignment.update).not.toHaveBeenCalled();
  });

  it("does not overwrite an assignment published during an edit", async () => {
    dbMock.assignment.findUnique.mockResolvedValue({ id: "assignment-1", classroomId: "class-1", status: "DRAFT" });
    dbMock.classroomMember.findUnique.mockResolvedValue({ role: "TEACHER" });
    dbMock.assignment.updateMany.mockResolvedValue({ count: 0 });

    await expect(updateDraftAssignment("teacher-1", "assignment-1", {
      title: "Titre",
      instructions: "Consigne",
      taskType: "free_writing",
    })).rejects.toThrow(AssignmentStateError);
    expect(dbMock.assignment.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
