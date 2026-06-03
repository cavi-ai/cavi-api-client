import type { HttpApiRequestInit } from "../../../core/http/types.js";
import type { GatewayMediaJsonValue } from "../../../core/gateway/resources/media.js";

// TTS endpoints are agent-specific and supplied by the caller (resolved from the
// team manifest) — the package binds no concrete agent's TTS routes.

export type PortalTtsProviderVoiceLike = {
  id: string;
  name?: string;
};

export type PortalTtsProviderLike = {
  id: string;
  label?: string;
  name?: string;
  configured?: boolean;
  voices?: readonly (PortalTtsProviderVoiceLike | string)[];
};

export type PortalTtsDashboardVoiceLike = {
  current_voice_id?: string;
  currentVoiceId?: string;
  current_voice_name?: string;
  currentVoiceName?: string;
  target_voice?: string;
  targetVoice?: string;
};

export type PortalTtsVoiceOption = {
  value: string;
  label: string;
  detail?: string;
  source: "gateway" | "dashboard";
  voiceId: string;
  providerId?: string;
  providerLabel?: string;
  agentKey?: string;
};

export type PortalTtsAgentVoiceAssignment = {
  agentKey: string;
  voiceValue: string;
  voiceId: string;
  voiceLabel: string;
  providerId?: string;
  providerLabel?: string;
  assignedAt: string;
};

export type PortalTtsJsonRequester = <T>(path: string) => Promise<T>;

export type PortalTtsBlobRequester = (
  path: string,
  init?: Pick<HttpApiRequestInit, "body" | "headers" | "method">,
) => Promise<Blob>;

export type PortalTtsAudioTransport = {
  requestBlob: PortalTtsBlobRequester;
};

export type PortalTtsAudioRequest = {
  text: string;
  voiceId?: string | null;
  providerId?: string | null;
  format?: string | null;
  accept?: string | null;
  options?: Record<string, GatewayMediaJsonValue>;
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getPortalTtsProviderLabel(provider: PortalTtsProviderLike): string {
  return cleanString(provider.label) || cleanString(provider.name) || provider.id;
}

function dashboardVoiceId(voice: PortalTtsDashboardVoiceLike): string {
  return cleanString(voice.current_voice_id) || cleanString(voice.currentVoiceId);
}

function dashboardVoiceLabel(
  agentKey: string,
  voice: PortalTtsDashboardVoiceLike,
): string {
  return (
    cleanString(voice.current_voice_name) ||
    cleanString(voice.currentVoiceName) ||
    cleanString(voice.target_voice) ||
    cleanString(voice.targetVoice) ||
    agentKey
  );
}

export function buildPortalTtsVoiceOptions(params: {
  providers?: readonly PortalTtsProviderLike[];
  activeProviderId?: string;
  dashboardVoices?: Record<string, PortalTtsDashboardVoiceLike>;
}): PortalTtsVoiceOption[] {
  const activeProviderId = cleanString(params.activeProviderId);
  const providers = Array.isArray(params.providers)
    ? [...params.providers].filter(
        (provider) =>
          provider.configured !== false &&
          Array.isArray(provider.voices) &&
          provider.voices.length > 0,
      )
    : [];

  providers.sort((a, b) => {
    const activeDiff =
      Number(b.id === activeProviderId) - Number(a.id === activeProviderId);
    if (activeDiff !== 0) return activeDiff;
    return getPortalTtsProviderLabel(a).localeCompare(getPortalTtsProviderLabel(b));
  });

  const gatewayOptions = new Map<string, PortalTtsVoiceOption>();
  for (const provider of providers) {
    const providerId = cleanString(provider.id);
    if (!providerId || !Array.isArray(provider.voices)) continue;
    const providerLabel = getPortalTtsProviderLabel(provider);
    const detail =
      providerId === activeProviderId ? `${providerLabel} (active)` : providerLabel;
    for (const voice of provider.voices) {
      const voiceId = typeof voice === "string" ? cleanString(voice) : cleanString(voice.id);
      if (!voiceId) continue;
      const value = `gateway:${providerId}:${voiceId}`;
      if (gatewayOptions.has(value)) continue;
      gatewayOptions.set(value, {
        value,
        label: (typeof voice === "string" ? "" : cleanString(voice.name)) || voiceId,
        detail,
        source: "gateway",
        voiceId,
        providerId,
        providerLabel,
      });
    }
  }

  if (gatewayOptions.size > 0) {
    return [...gatewayOptions.values()];
  }

  return Object.entries(params.dashboardVoices ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([agentKey, voice]) => {
      const voiceId = dashboardVoiceId(voice);
      if (!voiceId) return [];
      return [
        {
          value: `dashboard:${agentKey}:${voiceId}`,
          label: dashboardVoiceLabel(agentKey, voice),
          detail: `Dashboard voice (${agentKey})`,
          source: "dashboard" as const,
          voiceId,
          agentKey,
        },
      ];
    });
}

export function createPortalTtsAgentVoiceAssignment(params: {
  agentKey: string;
  voice: PortalTtsVoiceOption;
  assignedAt?: string;
}): PortalTtsAgentVoiceAssignment {
  return {
    agentKey: params.agentKey,
    voiceValue: params.voice.value,
    voiceId: params.voice.voiceId,
    voiceLabel: params.voice.label,
    ...(params.voice.providerId ? { providerId: params.voice.providerId } : {}),
    ...(params.voice.providerLabel ? { providerLabel: params.voice.providerLabel } : {}),
    assignedAt: params.assignedAt ?? new Date().toISOString(),
  };
}

export function requestPortalTtsProviders(
  requestJson: PortalTtsJsonRequester,
  providersPath: string,
): Promise<unknown> {
  return requestJson<unknown>(providersPath);
}

export async function requestPortalTtsAudio(
  transport: PortalTtsAudioTransport,
  ttsPath: string,
  body: PortalTtsAudioRequest,
): Promise<Blob> {
  const text = cleanString(body.text);
  if (!text) {
    throw new Error("Enter text to synthesize.");
  }
  const voiceId = cleanString(body.voiceId);
  const providerId = cleanString(body.providerId);
  const format = cleanString(body.format);
  const accept = cleanString(body.accept) || "audio/mpeg";

  return transport.requestBlob(ttsPath, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: accept,
    },
    body: {
      text,
      ...(voiceId ? { voiceId } : {}),
      ...(providerId ? { providerId } : {}),
      ...(format ? { format } : {}),
      ...(body.options ? { options: body.options } : {}),
    },
  });
}
