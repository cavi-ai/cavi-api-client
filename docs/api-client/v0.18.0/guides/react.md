---
documentedVersion: 0.18.0
---

# Show gateway connection state in React

Install React 18 or later and import the bindings from
`@cavi-ai/api-client/frameworks/react`. The root entry does not import React.

The [React gateway example](../examples/react-gateway.tsx) mounts
`GatewayClientProvider` and reads connection state with
`useGatewayClientContext`. Replace its example gateway URL and provide
authentication accepted by your application's gateway before using it.

## Application boundaries

These are gateway WebSocket context bindings; they are not a universal hook for
every runtime-only provider. Keep privileged provider keys on a server.
Gateway tokens and permissions should be appropriate to the browser user.

Let the mounted provider own its connection lifecycle. Render connection state
and errors explicitly, and do not show a successful run simply because the
socket is connected. Use the facade's result and run outcome for execution
state.

For runtime-only backends, call your trusted server's application API and render
its normalized output/events in React. Do not instantiate a provider with an
embedded server API key in a component.

[Provider setup](providers.md) · [Streaming](streaming.md) ·
[React declaration reference](../reference/frameworks-react.md)
