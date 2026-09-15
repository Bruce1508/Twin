import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe("authenticated data boundary", () => {
  it("keeps DEV_USER_ID out of application pages and route handlers", () => {
    const offenders = sourceFiles(join(process.cwd(), "app")).filter((path) =>
      readFileSync(path, "utf8").includes("process.env.DEV_USER_ID"),
    );

    expect(offenders).toEqual([]);
  });
});
