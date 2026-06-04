import { describe, expect, it, vi } from "vitest";

import {
  createOpenClawWorkboardRpc,
  OPENCLAW_RPC_METHODS,
  OPENCLAW_WORKBOARD_PRIORITIES,
  OPENCLAW_WORKBOARD_RPC_METHODS,
  OPENCLAW_WORKBOARD_STATUSES,
} from "../../../providers/openclaw/index.js";

describe("OpenClaw Workboard contract mirror", () => {
  it("mirrors OpenClaw Workboard statuses and priorities", () => {
    expect(OPENCLAW_WORKBOARD_STATUSES).toEqual([
      "triage",
      "backlog",
      "todo",
      "scheduled",
      "ready",
      "running",
      "review",
      "blocked",
      "done",
    ]);
    expect(OPENCLAW_WORKBOARD_PRIORITIES).toEqual([
      "low",
      "normal",
      "high",
      "urgent",
    ]);
  });

  it("mirrors native Workboard Gateway RPC method names", () => {
    expect(OPENCLAW_WORKBOARD_RPC_METHODS.cardsList).toBe(
      "workboard.cards.list",
    );
    expect(OPENCLAW_WORKBOARD_RPC_METHODS.cardsCreate).toBe(
      "workboard.cards.create",
    );
    expect(OPENCLAW_WORKBOARD_RPC_METHODS.cardsMove).toBe(
      "workboard.cards.move",
    );
    expect(OPENCLAW_WORKBOARD_RPC_METHODS.cardsDispatch).toBe(
      "workboard.cards.dispatch",
    );
    expect(OPENCLAW_WORKBOARD_RPC_METHODS.cardsReassign).toBe(
      "workboard.cards.reassign",
    );
    expect(OPENCLAW_WORKBOARD_RPC_METHODS.cardsClaim).toBe(
      "workboard.cards.claim",
    );
    expect(OPENCLAW_WORKBOARD_RPC_METHODS.boardsList).toBe(
      "workboard.boards.list",
    );
    expect(OPENCLAW_WORKBOARD_RPC_METHODS.notificationsEvents).toBe(
      "workboard.notifications.events",
    );
    expect(OPENCLAW_RPC_METHODS.workboardCardsList).toBe(
      "workboard.cards.list",
    );
  });

  it("routes helper calls through the provided RPC transport", async () => {
    const request = vi.fn(async () => ({
      card: {
        id: "card-1",
        title: "Smoke",
        status: "todo",
        priority: "normal",
        labels: [],
        position: 0,
        createdAt: 1,
        updatedAt: 2,
      },
    }));
    const rpc = createOpenClawWorkboardRpc({ request });

    await expect(
      rpc.createCard({ title: "Smoke", status: "todo" }),
    ).resolves.toMatchObject({
      card: { id: "card-1", title: "Smoke" },
    });
    expect(request).toHaveBeenCalledWith("workboard.cards.create", {
      title: "Smoke",
      status: "todo",
    });
  });
});
