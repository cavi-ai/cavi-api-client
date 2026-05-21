import type { OperatorControlSnapshot } from "../../../../../cavi/domain/index.js";
import { mockNow as now } from "../shared.js";

export const mockOperatorControlMemory: OperatorControlSnapshot["memory"] = {
  authority: "qdrant",
  storePath: "/state/cavi-control/operator-shared-memory.json",
  generatedAt: now - 45_000,
  collections: {
    "service-context": {
      count: 4,
      lastVerifiedAt: now - 4 * 60_000,
      writeMode: "upsert",
    },
    "task-outcomes": {
      count: 17,
      lastVerifiedAt: now - 2 * 60_000,
      writeMode: "append-only",
    },
    "contract-registry": {
      count: 11,
      lastVerifiedAt: now - 19 * 60_000,
      writeMode: "upsert",
    },
    "channel-events": {
      count: 23,
      lastVerifiedAt: now - 1 * 60_000,
      writeMode: "append-only",
    },
  },
  records: [
    {
      collection: "task-outcomes",
      recordId: "task-operator-1-outcome",
      scopeKey: "task-operator-1",
      summary: null,
      content: {
        task_id: "task-operator-1",
        outcome: "success",
      },
      metadata: {
        source: "operator-http-test",
        writer: "northstar",
        evidence_ref: "task://task-operator-1",
        verified_at: now - 2 * 60_000,
      },
      promotedAt: now - 2 * 60_000,
    },
    {
      collection: "service-context",
      recordId: "service-context:tonya",
      scopeKey: "tonya",
      summary: "Tonya owns operator routing",
      content: {
        primary: true,
      },
      metadata: {
        source: "operator-http-test",
        writer: "tonya",
        evidence_ref: "task://task-operator-1",
        verified_at: now - 3 * 60_000,
      },
      promotedAt: now - 3 * 60_000,
    },
  ],
};
