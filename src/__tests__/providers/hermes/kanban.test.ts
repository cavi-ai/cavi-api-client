import { describe, expect, it } from "vitest";
import {
  createHermesKanbanClient,
  type HermesKanbanRequest,
} from "../../../providers/hermes/kanban";
import { inspectKanbanConformance, validateKanbanCard } from "../../../testing/kanban-conformance";

/**
 * Minimal stand-in for the kanban plugin's REST surface, shaped from
 * hermes-agent/plugins/kanban/dashboard/plugin_api.py:
 *   GET   /board   -> { columns: [{ name, tasks: [...] }], ... }
 *   GET   /boards  -> { boards: [{ slug, ... }], current }
 *   POST  /tasks   -> { task }
 *   PATCH /tasks/:id -> { task }
 */
function fakePlugin(seed: Record<string, unknown>[] = []) {
  const tasks = new Map<string, Record<string, unknown>>();
  for (const t of seed) tasks.set(String(t.id), { ...t });
  const calls: Array<{ path: string; method: string; body?: unknown }> = [];
  let nextId = 100;

  const request: HermesKanbanRequest = async <T,>(
    path: string,
    init?: { method?: string; body?: unknown },
  ): Promise<T> => {
    const method = init?.method ?? "GET";
    calls.push({ path, method, body: init?.body });
    const [bare] = path.split("?");

    if (method === "GET" && bare.endsWith("/board")) {
      const byStatus = new Map<string, Record<string, unknown>[]>();
      for (const t of tasks.values()) {
        const s = String(t.status);
        byStatus.set(s, [...(byStatus.get(s) ?? []), t]);
      }
      return {
        columns: [...byStatus.entries()].map(([name, list]) => ({ name, tasks: list })),
      } as T;
    }
    if (method === "GET" && bare.endsWith("/boards")) {
      return { boards: [{ slug: "development", name: "Development" }], current: "development" } as T;
    }
    if (method === "POST" && bare.endsWith("/tasks")) {
      const body = (init?.body ?? {}) as Record<string, unknown>;
      const id = `t_${nextId++}`;
      const task = {
        id,
        title: body.title,
        body: body.body ?? null,
        assignee: body.assignee ?? null,
        status: body.triage === true ? "triage" : "todo",
        priority: body.priority ?? 0,
        created_at: 1000,
        skills: body.skills ?? null,
      };
      tasks.set(id, task);
      return { task } as T;
    }
    if (method === "PATCH" && bare.includes("/tasks/")) {
      const id = bare.split("/tasks/")[1];
      const existing = tasks.get(id);
      if (!existing) throw new Error(`no such task ${id}`);
      const body = (init?.body ?? {}) as Record<string, unknown>;
      const updated = { ...existing, ...body };
      tasks.set(id, updated);
      return { task: updated } as T;
    }
    throw new Error(`unexpected ${method} ${path}`);
  };

  return { request, calls, tasks };
}

const SEED = [
  { id: "t_1", title: "Ship it", body: "notes", assignee: "worker-a", status: "running",
    priority: 5, created_at: 10, started_at: 20, session_id: "s1", current_run_id: 7,
    skills: ["kanban-worker"], tenant: "cavi" },
  { id: "t_2", title: "Later", status: "todo", priority: 0, created_at: 11 },
];

describe("Hermes kanban client — canonical KanbanClient over the kanban plugin REST surface", () => {
  it("passes the shared kanban conformance suite", async () => {
    const { request } = fakePlugin(SEED);
    const report = await inspectKanbanConformance(createHermesKanbanClient(request));
    const failed = report.checks.filter((c) => !c.ok);
    expect(failed.map((c) => `${c.name}: ${c.detail ?? ""}`)).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("maps plugin tasks onto canonical cards", async () => {
    const { request } = fakePlugin(SEED);
    const { cards, statuses } = await createHermesKanbanClient(request).listCards();
    const running = cards.find((c) => c.id === "t_1");

    expect(validateKanbanCard(running!)).toEqual([]);
    expect(running).toMatchObject({
      title: "Ship it",
      notes: "notes",
      status: "running",
      category: "active",
      priority: "high",
      labels: ["kanban-worker"],
      agentId: "worker-a",
      links: { taskId: "t_1", sessionKey: "s1", runId: "7" },
      createdAt: 10,
      updatedAt: 20,
    });
    expect(running?.metadata).toMatchObject({ hermesPriority: 5, tenant: "cavi" });
    expect(statuses?.every((s) => typeof s.category === "string")).toBe(true);
  });

  it("maps the plugin's int priority onto the canonical enum and back", async () => {
    const { request, tasks } = fakePlugin();
    const client = createHermesKanbanClient(request);

    for (const [priority, raw] of [["low", -1], ["normal", 0], ["high", 1], ["urgent", 10]] as const) {
      const card = await client.createCard({ title: priority, priority });
      expect(tasks.get(card.id)?.priority).toBe(raw);
      // round-trips: the value written reads back as the same canonical priority
      expect(card.priority).toBe(priority);
    }
  });

  it("archives on deleteCard — the plugin has no hard-delete route", async () => {
    const { request, calls, tasks } = fakePlugin(SEED);
    await createHermesKanbanClient(request).deleteCard("t_1");

    expect(tasks.get("t_1")?.status).toBe("archived");
    const del = calls.find((c) => c.method === "DELETE");
    expect(del).toBeUndefined();
    expect(calls.at(-1)).toMatchObject({ method: "PATCH", body: { status: "archived" } });
  });

  it("surfaces the plugin's rejection of a direct move to running", async () => {
    // plugin_api.py: "Cannot set status to 'running' directly; use the
    // dispatcher/claim path" (400). Unlike OpenClaw, running is dispatcher-only.
    const { request } = fakePlugin(SEED);
    const failing: HermesKanbanRequest = async (path, init) => {
      const body = (init?.body ?? {}) as Record<string, unknown>;
      if (init?.method === "PATCH" && body.status === "running") {
        throw new Error("Cannot set status to 'running' directly; use the dispatcher/claim path");
      }
      return await request(path, init);
    };
    await expect(createHermesKanbanClient(failing).moveCard("t_2", "running")).rejects.toThrow(
      /dispatcher\/claim path/u,
    );
    // every other native status still passes through
    await expect(createHermesKanbanClient(failing).moveCard("t_2", "done")).resolves.toMatchObject({
      status: "done",
      category: "done",
    });
  });

  it("categorizes ready as todo, matching the OpenClaw adapter", async () => {
    const { request } = fakePlugin([{ id: "t_r", title: "r", status: "ready", priority: 0, created_at: 1 }]);
    const { cards } = await createHermesKanbanClient(request).listCards();
    expect(cards[0]).toMatchObject({ status: "ready", category: "todo" });
  });

  it("scopes requests to a board slug when given", async () => {
    const { request, calls } = fakePlugin(SEED);
    await createHermesKanbanClient(request, { boardId: "development" }).listCards();
    expect(calls[0]?.path).toContain("board=development");
  });

  it("derives position from column order", async () => {
    const { request } = fakePlugin([
      { id: "a", title: "a", status: "todo", priority: 9, created_at: 1 },
      { id: "b", title: "b", status: "todo", priority: 0, created_at: 2 },
    ]);
    const { cards } = await createHermesKanbanClient(request).listCards();
    expect(cards.map((c) => [c.id, c.position])).toEqual([["a", 0], ["b", 1]]);
  });
});
