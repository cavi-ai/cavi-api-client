import { ApiClientError, ApiClientErrorCode } from "../../../core/errors.js";
import type { RuntimeRunState } from "../../../core/runtime/run.js";

export function managedLifecycleProtocolError(): ApiClientError {
  return new ApiClientError("claude managed-agents: invalid or excessive event history", {
    code: ApiClientErrorCode.TransportProtocolError,
  });
}

/** Rebuild primary-thread completion from ordered history, then accept live events. */
export class ManagedAgentLifecycle {
  status: RuntimeRunState = "unknown";
  output: string | undefined;
  private interrupted = false;
  private readonly openWorkflows = new Set<string>();
  private readonly seen = new Set<string>();
  private outputBytes = 0;

  accept(event: Record<string, unknown>): void {
    if (event.session_thread_id) return;
    if (typeof event.id === "string") {
      if (this.seen.has(event.id)) return;
      this.seen.add(event.id);
    }
    const type = event.type;
    if (type === "user.message" || type === "user.define_outcome") {
      this.interrupted = false;
      this.status = "running";
      this.output = undefined;
      this.outputBytes = 0;
    } else if (type === "user.interrupt") {
      this.interrupted = true;
      this.status = "paused";
    } else if (type === "workflow_run.created" || type === "workflow_run.status_running" || type === "workflow_run.status_idle") {
      if (typeof event.workflow_run_id !== "string" || !event.workflow_run_id) throw managedLifecycleProtocolError();
      this.openWorkflows.add(event.workflow_run_id);
      this.status = "running";
    } else if (type === "workflow_run.status_ended") {
      if (typeof event.workflow_run_id !== "string" || !event.workflow_run_id) throw managedLifecycleProtocolError();
      this.openWorkflows.delete(event.workflow_run_id);
      this.status = "running";
    } else if (type === "session.status_running" || type === "status_running" || type === "session.status_rescheduled" || type === "status_rescheduled") {
      this.status = "running";
    } else if (type === "session.status_idle" || type === "status_idle") {
      const reason = event.stop_reason as { type?: unknown } | undefined;
      this.status = reason?.type === "end_turn" && !this.interrupted
        ? this.openWorkflows.size === 0 ? "completed" : "running"
        : "paused";
    } else if (type === "session.status_terminated" || type === "status_terminated") {
      this.status = "unknown";
    } else if (type === "agent.message") {
      if (!Array.isArray(event.content)) throw managedLifecycleProtocolError();
      for (const content of event.content) {
        if (content?.type !== "text") continue;
        if (typeof content.text !== "string") throw managedLifecycleProtocolError();
        this.outputBytes += new TextEncoder().encode(content.text).length;
        if (this.outputBytes > 1_048_576) throw managedLifecycleProtocolError();
        this.output = (this.output ?? "") + content.text;
      }
    }
  }
}
