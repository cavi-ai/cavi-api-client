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
