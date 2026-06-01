import { describe, expect, it } from "vitest";
import { GatewayApiClient } from "../../../core/gateway/client/client";
import type { RuntimeClient } from "../../../core/runtime/client";
import type {
  GatewayRunStartBody,
  GatewayRunStatus,
} from "../../../core/gateway/client/client";
import type { RuntimeRunStartBody, RuntimeRunStatus } from "../../../core/runtime/run";

describe("GatewayApiClient is a RuntimeClient", () => {
  it("assigns to the RuntimeClient interface and exposes cancelRun", () => {
    const client = new GatewayApiClient({ baseUrl: "https://gw.example" });
    const asRuntime: RuntimeClient = client; // compile-time assertion
    expect(typeof asRuntime.startRun).toBe("function");
    expect(typeof asRuntime.cancelRun).toBe("function");
    expect(typeof asRuntime.getRuntimeCapabilities).toBe("function");
  });

  it("Gateway run types are extensions of the minimal runtime types", () => {
    const gwBody: GatewayRunStartBody = { input: "hi", session_id: "s1", targetProfile: "p" };
    const asRuntimeBody: RuntimeRunStartBody = gwBody; // gateway extends runtime
    expect(asRuntimeBody.input).toBe("hi");

    const gwStatus: GatewayRunStatus = { run_id: "r1", status: "running", session_id: "s1" };
    const asRuntimeStatus: RuntimeRunStatus = gwStatus;
    expect(asRuntimeStatus.run_id).toBe("r1");
  });
});
