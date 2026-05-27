import { describe, expect, it, vi } from "vitest";
import type { JsonHttpRequest } from "../../../../core/http/json-client";
import {
  operatorTaskDiscoursePath,
  operatorTaskDiscoursePluginAliasPath,
} from "../../../../extensions/cavi/contracts/paths";
import { loadTaskDiscourseLive } from "../../../../extensions/cavi/discourse/live";

describe("loadTaskDiscourseLive", () => {
  it("uses the plugin alias when primary task discourse HTTP fallback is unavailable", async () => {
    const requestJson = vi.fn(async (path: string) => {
      if (path === operatorTaskDiscoursePath("task-1")) {
        throw new Error("primary unavailable");
      }
      if (path === operatorTaskDiscoursePluginAliasPath("task-1")) {
        return {
          rootTaskId: "task-1",
          events: [],
          agents: [],
          delegationTree: [],
        };
      }
      throw new Error(`unexpected path: ${path}`);
    }) as JsonHttpRequest;

    await expect(loadTaskDiscourseLive(requestJson, null, "task-1")).resolves.toMatchObject({
      rootTaskId: "task-1",
      events: [],
      agents: [],
      delegationTree: [],
    });
    expect(requestJson).toHaveBeenCalledWith(operatorTaskDiscoursePath("task-1"));
    expect(requestJson).toHaveBeenCalledWith(
      operatorTaskDiscoursePluginAliasPath("task-1"),
    );
  });
});
