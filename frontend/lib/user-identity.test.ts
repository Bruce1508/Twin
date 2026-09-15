import { describe, expect, it } from "vitest";
import {
  AuthenticationRequiredError,
  resolveUserIdentity,
  type UserIdentity,
} from "@/lib/user-identity";

const teacher: UserIdentity = { id: "teacher-1", email: "teacher@example.com", name: "Teacher" };
const student: UserIdentity = { id: "student-1", email: "student@example.com", name: "Student" };

describe("resolveUserIdentity", () => {
  it("keeps authenticated accounts isolated", () => {
    expect(
      resolveUserIdentity({ sessionUser: teacher, developmentUser: null, environment: "production" }),
    ).toEqual(teacher);
    expect(
      resolveUserIdentity({ sessionUser: student, developmentUser: null, environment: "production" }),
    ).toEqual(student);
  });

  it("allows the configured local user only during development", () => {
    expect(
      resolveUserIdentity({ sessionUser: null, developmentUser: teacher, environment: "development" }),
    ).toEqual(teacher);
    expect(() =>
      resolveUserIdentity({ sessionUser: null, developmentUser: teacher, environment: "production" }),
    ).toThrow(AuthenticationRequiredError);
  });

  it("prefers a real session over the development user", () => {
    expect(
      resolveUserIdentity({ sessionUser: student, developmentUser: teacher, environment: "development" }),
    ).toEqual(student);
  });

  it("rejects requests without an identity", () => {
    expect(() =>
      resolveUserIdentity({ sessionUser: null, developmentUser: null, environment: "test" }),
    ).toThrow(AuthenticationRequiredError);
  });
});
