// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  GatewayClientProvider,
  type GatewayClientContextValue,
  type GatewayConnectionState,
  type GatewayStreamEvent,
  useGatewayClientContext,
  useGatewayConnectionState,
  useGatewayRpc,
} from "../../../frameworks/react";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mounted: Array<{ root: Root; container: HTMLElement }> = [];

async function renderReact(element: ReactElement): Promise<Root> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  await act(async () => {
    root.render(element);
  });
  return root;
}

async function unmountReact(root: Root): Promise<void> {
  const index = mounted.findIndex((entry) => entry.root === root);
  if (index === -1) {
    return;
  }
  const [{ container }] = mounted.splice(index, 1);
  await act(async () => {
    root.unmount();
  });
  container.remove();
}

afterEach(async () => {
  while (mounted.length > 0) {
    await unmountReact(mounted[mounted.length - 1].root);
  }
  vi.restoreAllMocks();
});

describe("React gateway bindings", () => {
  it("provides idle context state and reports invalid gateway URLs", async () => {
    const snapshots: GatewayClientContextValue[] = [];

    function Probe(): null {
      snapshots.push(useGatewayClientContext());
      return null;
    }

    await renderReact(
      createElement(
        GatewayClientProvider,
        {
          gatewayBaseUrl: "not a url",
          authToken: null,
          clientId: "client-1",
        },
        createElement(Probe),
      ),
    );

    const latest = snapshots.at(-1);
    expect(latest?.client).toBeNull();
    expect(latest?.state).toBe("idle");
    expect(latest?.connectionError).toBeNull();
    expect(latest?.urlError?.message).toContain("Invalid gateway URL");
    expect(latest?.connect).toEqual(expect.any(Function));
    expect(latest?.disconnect).toEqual(expect.any(Function));
  });

  it("tracks connection state updates and unsubscribes on unmount", async () => {
    let emitState:
      | ((state: GatewayConnectionState, error: Error | null) => void)
      | null = null;
    const unsubscribe = vi.fn();
    const client = {
      getConnectionState: vi.fn(() => "connecting" as GatewayConnectionState),
      onStateChange: vi.fn((handler) => {
        emitState = handler;
        return unsubscribe;
      }),
    } as unknown as Parameters<typeof useGatewayConnectionState>[0];
    const snapshots: GatewayConnectionState[] = [];

    function Probe(): null {
      snapshots.push(useGatewayConnectionState(client));
      return null;
    }

    const root = await renderReact(createElement(Probe));

    expect(snapshots.at(-1)).toBe("connecting");
    await act(async () => {
      emitState?.("connected", null);
    });
    expect(snapshots.at(-1)).toBe("connected");

    await unmountReact(root);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("requests RPC data and refreshes only on matching gateway events", async () => {
    const eventHandlers = new Set<(event: GatewayStreamEvent) => void>();
    const params = { scope: "operator" };
    const request = vi.fn(async () => ({ ok: true }));
    const client = {
      request,
      onEvent: vi.fn((handler) => {
        eventHandlers.add(handler);
        return () => eventHandlers.delete(handler);
      }),
    } as unknown as Parameters<typeof useGatewayRpc<{ ok: boolean }>>[0];
    const snapshots: Array<ReturnType<typeof useGatewayRpc<{ ok: boolean }>>> = [];

    function Probe(): null {
      snapshots.push(
        useGatewayRpc<{ ok: boolean }>(client, "gateway.status", params, {
          refreshOnEvents: ["gateway.updated"],
        }),
      );
      return null;
    }

    await renderReact(createElement(Probe));
    await act(async () => {
      await Promise.resolve();
    });

    expect(request).toHaveBeenCalledWith("gateway.status", params);
    expect(snapshots.at(-1)?.data).toEqual({ ok: true });
    expect(snapshots.at(-1)?.error).toBeNull();
    expect(snapshots.at(-1)?.loading).toBe(false);

    await act(async () => {
      for (const handler of eventHandlers) {
        handler({ event: "gateway.ignored" } as GatewayStreamEvent);
      }
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledTimes(1);

    await act(async () => {
      for (const handler of eventHandlers) {
        handler({ event: "gateway.updated" } as GatewayStreamEvent);
      }
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledTimes(2);
  });
});
