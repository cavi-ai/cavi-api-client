import type { RuntimeCapabilities } from "@cavi-ai/api-client/core/runtime";

export const capabilitiesFixture: RuntimeCapabilities = {
  providerKind: "compatible-runtime",
  protocolVersion: "v1",
  supports: {
    runs: true,
    streaming: true,
  },
};
