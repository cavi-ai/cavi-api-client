import { GatewayClientProvider, useGatewayClientContext } from "@cavi-ai/api-client/frameworks/react";

function ConnectionStatus() {
  const { state } = useGatewayClientContext();
  return <span>{state}</span>;
}

export function GatewayApp() {
  return (
    <GatewayClientProvider gatewayBaseUrl="https://gateway.example" authToken={null} clientId="docs-example">
      <ConnectionStatus />
    </GatewayClientProvider>
  );
}
