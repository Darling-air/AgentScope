import { describe, it, expect } from "vitest";
import { normalizeTargetPath } from "./path-normalizer.js";

const CWD = "G:/AgentScope";

describe("normalizeTargetPath", () => {
  it("keeps a relative path relative, normalizing separators", () => {
    expect(normalizeTargetPath(".env.local", CWD)).toBe(".env.local");
    expect(normalizeTargetPath("src\\auth\\login.ts", CWD)).toBe(
      "src/auth/login.ts",
    );
  });

  it("makes a POSIX-absolute path under cwd repo-relative", () => {
    expect(normalizeTargetPath("G:/AgentScope/.env.local", CWD)).toBe(
      ".env.local",
    );
    expect(
      normalizeTargetPath("G:/AgentScope/src/auth/login.ts", CWD),
    ).toBe("src/auth/login.ts");
  });

  it("makes a Windows-absolute path under cwd repo-relative", () => {
    expect(
      normalizeTargetPath("G:\\AgentScope\\.env.local", "G:\\AgentScope"),
    ).toBe(".env.local");
    expect(
      normalizeTargetPath(
        "G:\\AgentScope\\src\\auth\\login.ts",
        "G:\\AgentScope",
      ),
    ).toBe("src/auth/login.ts");
  });

  it("compares the drive letter case-insensitively", () => {
    expect(normalizeTargetPath("g:/AgentScope/.env.local", "G:/AgentScope")).toBe(
      ".env.local",
    );
  });

  it("collapses a path equal to cwd into '.'", () => {
    expect(normalizeTargetPath("G:/AgentScope", CWD)).toBe(".");
    expect(normalizeTargetPath("G:/AgentScope/", CWD)).toBe(".");
  });

  it("returns a normalized absolute path when outside cwd (no crash, no collapse)", () => {
    expect(normalizeTargetPath("G:/OtherRepo/.env.local", CWD)).toBe(
      "G:/OtherRepo/.env.local",
    );
  });

  it("does not treat a sibling prefix as a child of cwd", () => {
    // "G:/AgentScopeOther" must not be seen as living under "G:/AgentScope".
    expect(normalizeTargetPath("G:/AgentScopeOther/x.ts", CWD)).toBe(
      "G:/AgentScopeOther/x.ts",
    );
  });

  it("returns the normalized file path when cwd is missing", () => {
    expect(normalizeTargetPath("G:\\AgentScope\\.env.local")).toBe(
      "G:/AgentScope/.env.local",
    );
  });
});
