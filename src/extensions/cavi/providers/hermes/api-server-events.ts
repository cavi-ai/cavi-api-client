import type { RuntimeControlPlaneEvent, RuntimeEventClient, RuntimeEventSubscription } from "../../../../core/runtime/control-plane/events.js";
import { CapabilityUnavailable } from "../../../../core/runtime/control-plane/runtime-control-client.js";
import type { RunStreamEvent } from "../../../../core/runtime/run-stream.js";
import { HermesSseRunEventProvider } from "../../../../providers/hermes/sse-run-event-provider.js";

export type HermesApiServerRunEventsOptions = Readonly<{
  runId: string;
  sessionKey: string;
  clientId: string;
  baseUrl: string;
  token: string | null;
  fetchImpl?: typeof fetch;
}>;

function metadata() {
  return { provider: "hermes", stability: "experimental" as const, source: { transport: "sse" as const, method: "run.events" } };
}

function normalize(event: RunStreamEvent): RuntimeControlPlaneEvent {
  const base = { operationId: event.runId, metadata: metadata() };
  switch (event.event) {
    case "message.delta": return { ...base, event: "message.delta", delta: event.delta };
    case "run.completed": return { ...base, event: "operation.completed" };
    case "run.failed": return { ...base, event: "operation.failed", error: { message: event.error } };
    case "run.cancelled": return { ...base, event: "operation.cancelled" };
    case "approval.request": return { ...base, event: "approval.requested", approvalId: event.runId, request: { choices: event.choices } };
    case "tool.call.started": return { ...base, event: "tool.started", toolCallId: event.toolCall.id, toolName: event.toolCall.name };
    case "tool.call.completed": return { ...base, event: "tool.completed", toolCallId: event.toolCall.id, result: event.toolCall.output };
    case "tool.call.failed": return { ...base, event: "operation.updated", update: { toolCall: event.toolCall } };
  }
}

export interface HermesApiServerEventClient extends RuntimeEventClient {
  dispose(): Promise<void>;
}

export function createHermesApiServerEventClient(options: HermesApiServerRunEventsOptions): HermesApiServerEventClient {
  const runId = options.runId.trim();
  if (!runId) throw new TypeError("Hermes API Server runId must be a non-empty existing run id");
  const provider = new HermesSseRunEventProvider({
    httpBase: options.baseUrl,
    authToken: options.token,
    clientId: options.clientId,
    sessionKey: options.sessionKey,
    fetchImpl: options.fetchImpl,
    fallbackToPoll: false,
  });
  const subscriptions = new Set<RuntimeEventSubscription>();
  let disposed = false;
  let disposePromise: Promise<void> | undefined;
  return {
    async subscribe(params, handlers) {
      if (disposed) throw new CapabilityUnavailable("hermes", "controlPlane.events.subscribe");
      if (params.cursor !== undefined) throw new CapabilityUnavailable("hermes", "controlPlane.events.cursor");
      if (params.operationId !== runId) throw new CapabilityUnavailable("hermes", "controlPlane.events.operationId");
      let active = true;
      let registered = false;
      let subscription: RuntimeEventSubscription | undefined;
      const complete = (): void => {
        if (!active) return;
        active = false;
        if (registered && subscription) subscriptions.delete(subscription);
      };
      const inner = await provider.subscribe({ runId, signal: params.signal }, {
        onEvent: (event) => {
          if (!active || disposed) return;
          const normalized = normalize(event);
          try { handlers.onEvent(normalized); }
          catch (error) {
            try { handlers.onError?.(error); } catch { /* Subscribers are isolated. */ }
          }
          finally {
            if (normalized.event === "operation.completed"
              || normalized.event === "operation.failed"
              || normalized.event === "operation.cancelled"
              || normalized.event === "operation.interrupted") complete();
          }
        },
        onError: (error) => {
          if (!active || disposed) return;
          try { handlers.onError?.(error); } catch { /* Subscribers are isolated. */ }
          finally { complete(); }
        },
        onComplete: complete,
      });
      subscription = {
        dispose() {
          if (!active) return;
          active = false;
          if (subscription) subscriptions.delete(subscription);
          return inner.dispose();
        },
      };
      // A finite or failed stream may settle before provider.subscribe returns.
      // In that case it has already released its handlers and must not be
      // registered only to be aborted later by runtime disposal.
      if (!active) return subscription;
      if (disposed) {
        await subscription.dispose();
        throw new CapabilityUnavailable("hermes", "controlPlane.events.subscribe");
      }
      subscriptions.add(subscription);
      registered = true;
      return subscription;
    },
    dispose() {
      disposePromise ??= (async () => {
        disposed = true;
        const active = [...subscriptions];
        subscriptions.clear();
        await Promise.all(active.map((subscription) => subscription.dispose()));
      })();
      return disposePromise;
    },
  };
}
