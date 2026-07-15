import { describe, expect, it } from "vitest";
import {
  SynchronousRunStore,
  unknownSynchronousRun,
} from "../../../core/runtime/synchronous-run-store.js";
import type { RuntimeRunStatus } from "../../../core/runtime/run.js";

const status = (run_id: string, s = "completed"): RuntimeRunStatus => ({ run_id, status: s });

describe("SynchronousRunStore", () => {
  it("remembers and returns a run by id", () => {
    const store = new SynchronousRunStore();
    store.remember(status("run_1"));
    expect(store.get("run_1")).toEqual({ run_id: "run_1", status: "completed" });
  });

  it("returns undefined for an unknown id", () => {
    expect(new SynchronousRunStore().get("nope")).toBeUndefined();
  });

  it("ignores a status with no run_id", () => {
    const store = new SynchronousRunStore();
    store.remember({ run_id: "", status: "completed" });
    expect(store.get("")).toBeUndefined();
  });

  it("evicts the oldest entry past capacity", () => {
    const store = new SynchronousRunStore(2);
    store.remember(status("a"));
    store.remember(status("b"));
    store.remember(status("c"));
    expect(store.get("a")).toBeUndefined();
    expect(store.get("b")).toBeDefined();
    expect(store.get("c")).toBeDefined();
  });

  it("refreshes recency on re-remember so a touched entry is not evicted", () => {
    const store = new SynchronousRunStore(2);
    store.remember(status("a"));
    store.remember(status("b"));
    store.remember(status("a", "failed"));
    store.remember(status("c"));
    expect(store.get("a")).toEqual({ run_id: "a", status: "failed" });
    expect(store.get("b")).toBeUndefined();
  });

  it("unknownSynchronousRun is an honest, non-throwing terminal status", () => {
    const s = unknownSynchronousRun("gemini", "x");
    expect(s.run_id).toBe("x");
    expect(s.status).toBe("unknown");
    expect(typeof s.error).toBe("string");
    expect(s.error).toContain("gemini");
  });
});
