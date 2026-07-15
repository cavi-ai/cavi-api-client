import type {
  RawGatewayChannel,
  RawGatewayConnectionState,
  RawGatewayEvent,
} from "../core/runtime/control-plane/raw-gateway.js";
import { GATEWAY_RAW_EXTENSION } from "../core/runtime/control-plane/raw-gateway.js";
import type { RuntimeControlExtensionDescriptor } from "../core/runtime/control-plane/extensions.js";
import { CapabilityUnavailable } from "../core/runtime/control-plane/runtime-control-client.js";

export type RawGatewayConformanceFixture = Readonly<{
  channel: RawGatewayChannel;
  descriptor: RuntimeControlExtensionDescriptor<RawGatewayChannel>;
  response: unknown;
  ordinaryOperationId: string;
  ordinaryError: unknown;
  unsupportedOperationId: string;
  emitEvent: (event: RawGatewayEvent) => void;
  emitState: (state: RawGatewayConnectionState) => void;
  disposalCount: () => number;
  connectCount: () => number;
  /** Optional rejection identity used to prove rejected disposal is still cached exact-once. */
  expectedDisposalError?: unknown;
}>;

export type RawGatewayConformanceReport = Readonly<{
  valid: boolean;
  failures: readonly string[];
}>;

export type RawGatewayConformanceFactory =
  () => RawGatewayConformanceFixture | Promise<RawGatewayConformanceFixture>;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Exercise the provider-neutral raw gateway contract without selecting a provider. */
export async function runRawGatewayConformance(
  createChannel: RawGatewayConformanceFactory,
): Promise<RawGatewayConformanceReport> {
  const fixture = await createChannel();
  const { channel } = fixture;
  const failures: string[] = [];

  if (fixture.descriptor !== GATEWAY_RAW_EXTENSION) {
    failures.push("fixture did not use the canonical gateway.raw descriptor");
  }

  try {
    const response = await channel.request("conformance.request", { probe: true });
    if (response !== fixture.response) {
      failures.push("request did not preserve the successful response");
    }
  } catch (error) {
    failures.push(`supported request rejected: ${message(error)}`);
  }

  const payload = Object.freeze({ probe: "raw-event" });
  const event = Object.freeze({ event: "conformance.event", payload });
  let received: RawGatewayEvent | undefined;
  const unsubscribeThrowing = channel.subscribe(() => {
    throw new Error("intentional listener failure");
  });
  const unsubscribeReceiving = channel.subscribe((next) => { received = next; });
  fixture.emitEvent(event);
  unsubscribeThrowing();
  unsubscribeReceiving();
  if (received?.event !== event.event || received.payload !== payload) {
    failures.push("raw event name or payload identity changed");
  }

  const states: RawGatewayConnectionState[] = [];
  const unsubscribeState = channel.onConnectionState((state) => states.push(state));
  for (const state of ["connecting", "reconnecting", "connected"] as const) {
    fixture.emitState(state);
  }
  unsubscribeState();
  if (states.join(",") !== "connecting,reconnecting,connected") {
    failures.push(`connection states were out of order: ${states.join(",")}`);
  }
  if (channel.getConnectionState() !== "connected") {
    failures.push("reconnect did not restore connected state");
  }

  const abortReason = new Error("raw gateway conformance abort");
  const controller = new AbortController();
  controller.abort(abortReason);
  try {
    await channel.request("conformance.abort", undefined, { signal: controller.signal });
    failures.push("pre-aborted request resolved");
  } catch (error) {
    if (error !== abortReason) failures.push("pre-aborted request did not preserve its abort reason");
  }

  try {
    await channel.request(fixture.unsupportedOperationId);
    failures.push("unsupported operation resolved");
  } catch (error) {
    if (!(error instanceof CapabilityUnavailable)) {
      failures.push("unsupported operation did not reject with CapabilityUnavailable");
    } else if (error.capability !== fixture.unsupportedOperationId) {
      failures.push("unsupported operation did not identify its operation ID");
    }
  }

  try {
    await channel.request(fixture.ordinaryOperationId);
    failures.push("ordinary provider error resolved");
  } catch (error) {
    if (error !== fixture.ordinaryError) {
      failures.push("ordinary provider error identity changed");
    }
  }

  const firstConnect = channel.connect();
  const secondConnect = channel.connect();
  if (firstConnect !== secondConnect) {
    failures.push("connect did not return its cached promise");
  }
  await Promise.all([firstConnect, secondConnect]);
  if (fixture.connectCount() !== 1) {
    failures.push(`channel invoked its connect fixture ${fixture.connectCount()} times`);
  }
  const firstDisposal = channel.dispose();
  const secondDisposal = channel.dispose();
  const thirdDisposal = channel.dispose();
  if (firstDisposal !== secondDisposal || firstDisposal !== thirdDisposal) {
    failures.push("dispose did not return its cached promise");
  }
  try {
    await Promise.all([firstDisposal, secondDisposal, thirdDisposal]);
  } catch (error) {
    if (error !== fixture.expectedDisposalError) {
      failures.push(`disposal rejected: ${message(error)}`);
    }
  }
  if (fixture.disposalCount() !== 1) {
    failures.push(`channel disposed its owned fixture ${fixture.disposalCount()} times`);
  }

  return Object.freeze({ valid: failures.length === 0, failures: Object.freeze(failures) });
}
