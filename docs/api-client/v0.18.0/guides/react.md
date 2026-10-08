---
documentedVersion: 0.18.0
---

# Put runtime output in a React application

For Claude, Codex, AGY, or OpenCode, keep the provider client on your server.
Call your application's [request endpoint](server.md), render its returned
run state/text, or deliver [stream deltas](streaming.md) through your
application's chosen transport. The package does not provide a universal
runtime chat hook.

## Gateway connection bindings

For a gateway that speaks the bindings' WebSocket protocol, install React 18
or later and import `@cavi-ai/api-client/frameworks/react`. These bindings
manage a gateway connection; connection success is not run completion.
They are not an adapter for every gateway's transport, including Hermes'
dashboard JSON-RPC channel.

Pass your gateway URL, browser-user token, and accepted client identity into
the mounted provider. Handle invalid addresses and handshake failures as
visible state. Download [GatewayApp](../examples/react-gateway.tsx).

```tsx
import { GatewayClientProvider, useGatewayClientContext } from "@cavi-ai/api-client/frameworks/react";

function ConnectionStatus() {
  const { state, urlError, connectionError } = useGatewayClientContext();
  if (urlError) return <p role="alert">Invalid gateway address.</p>;
  if (connectionError) return <p role="alert">Gateway connection failed.</p>;
  return <p role="status">Gateway: {state}</p>;
}

export function GatewayApp(config: { gatewayUrl: string; token: string; clientId: string }) {
  return (
    <GatewayClientProvider gatewayBaseUrl={config.gatewayUrl} authToken={config.token} clientId={config.clientId}>
      <ConnectionStatus />
    </GatewayClientProvider>
  );
}
```

Use credentials scoped to the browser user and permissions allowed by the
gateway. A provider API key does not belong in these props. The gateway must
accept the browser origin, client identity, and any requested scopes.

Let the mounted provider own the connection lifecycle. Do not create a second
facade connection just to read socket state. If your application also runs work
through a separately owned facade, use its result and terminal outcome for
execution state.

The root entry does not import React.
[React declarations](../reference/frameworks-react.md) · [Gateway resources](gateway.md)
