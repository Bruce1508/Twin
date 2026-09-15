import { randomBytes } from "node:crypto";

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JOIN_CODE_LENGTH = 10;
const CLASSROOM_NAME_MAX_LENGTH = 80;

export const CLASSROOM_ROLES = ["TEACHER", "STUDENT"] as const;
export type ClassroomRoleName = (typeof CLASSROOM_ROLES)[number];

export function normalizeClassroomName(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Classroom name is required");
  }

  const name = value.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Classroom name is required");
  if (name.length > CLASSROOM_NAME_MAX_LENGTH) {
    throw new Error(`Classroom name must be ${CLASSROOM_NAME_MAX_LENGTH} characters or fewer`);
  }

  return name;
}

export function normalizeJoinCode(value: unknown): string {
  if (typeof value !== "string") throw new Error("Join code is required");

  const code = value.trim().toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== JOIN_CODE_LENGTH) throw new Error("Join code is invalid");
  if ([...code].some((character) => !JOIN_CODE_ALPHABET.includes(character))) {
    throw new Error("Join code is invalid");
  }

  return code;
}

export function generateJoinCode(): string {
  return [...randomBytes(JOIN_CODE_LENGTH)]
    .map((byte) => JOIN_CODE_ALPHABET[byte % JOIN_CODE_ALPHABET.length])
    .join("");
}

export function hasClassroomRole(
  role: ClassroomRoleName,
  allowedRoles: readonly ClassroomRoleName[],
): boolean {
  return allowedRoles.includes(role);
}
