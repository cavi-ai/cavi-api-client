import { describe, expect, it } from "vitest";
import {
  opencodeEventPath,
  opencodeHealthPath,
  opencodeSessionAbortPath,
  opencodeSessionCreatePath,
  opencodeSessionMessagePath,
  opencodeSessionPath,
  opencodeSessionPromptAsyncPath,
  opencodeSessionStatusPath,
  opencodeScopeQuery,
} from "../../../providers/opencode/paths";

const scope = { directory: "/workspace/project", workspace: "team-a" };

describe("OpenCode scoped paths", () => {
  it("leaves global health unscoped", () => {
    expect(opencodeHealthPath()).toBe("/global/health");
  });

  it("encodes scope in deterministic directory-then-workspace order", () => {
    expect(opencodeScopeQuery(scope)).toBe("?directory=%2Fworkspace%2Fproject&workspace=team-a");
    expect(opencodeScopeQuery({ directory: "/workspace/project" })).toBe("?directory=%2Fworkspace%2Fproject");
  });

  it("builds all verified scoped routes", () => {
    expect(opencodeEventPath(scope)).toBe("/event?directory=%2Fworkspace%2Fproject&workspace=team-a");
    expect(opencodeSessionCreatePath(scope)).toBe("/session?directory=%2Fworkspace%2Fproject&workspace=team-a");
    expect(opencodeSessionStatusPath(scope)).toBe("/session/status?directory=%2Fworkspace%2Fproject&workspace=team-a");
    expect(opencodeSessionPath(scope, "ses_1")).toBe("/session/ses_1?directory=%2Fworkspace%2Fproject&workspace=team-a");
    expect(opencodeSessionMessagePath(scope, "ses_a/b")).toBe("/session/ses_a%2Fb/message?directory=%2Fworkspace%2Fproject&workspace=team-a");
    expect(opencodeSessionPromptAsyncPath(scope, "ses_1")).toBe("/session/ses_1/prompt_async?directory=%2Fworkspace%2Fproject&workspace=team-a");
    expect(opencodeSessionAbortPath(scope, "ses_1")).toBe("/session/ses_1/abort?directory=%2Fworkspace%2Fproject&workspace=team-a");
  });
});
