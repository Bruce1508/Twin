import { describe, expect, it } from "vitest";
import {
  generateJoinCode,
  hasClassroomRole,
  normalizeClassroomName,
  normalizeJoinCode,
} from "@/lib/classroom";

describe("normalizeClassroomName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeClassroomName("  Français   du samedi  ")).toBe("Français du samedi");
  });

  it("rejects missing and oversized names", () => {
    expect(() => normalizeClassroomName("   ")).toThrow("Classroom name is required");
    expect(() => normalizeClassroomName("a".repeat(81))).toThrow(
      "Classroom name must be 80 characters or fewer",
    );
  });

  it("checks classroom roles without treating them as global user roles", () => {
    expect(hasClassroomRole("TEACHER", ["TEACHER"])).toBe(true);
    expect(hasClassroomRole("STUDENT", ["TEACHER"])).toBe(false);
    expect(hasClassroomRole("STUDENT", ["TEACHER", "STUDENT"])).toBe(true);
  });
});

describe("join codes", () => {
  it("generates a readable ten-character code", () => {
    expect(generateJoinCode()).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
  });

  it("normalizes case, spaces, and separators", () => {
    expect(normalizeJoinCode("abcd-ef 2345")).toBe("ABCDEF2345");
  });

  it("rejects ambiguous and malformed codes", () => {
    expect(() => normalizeJoinCode("ABCD0F2345")).toThrow("Join code is invalid");
    expect(() => normalizeJoinCode("short")).toThrow("Join code is invalid");
  });
});
