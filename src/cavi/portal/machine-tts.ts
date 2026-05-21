import { CAVI_CONTROL_API_ENDPOINTS } from "../paths.js";
import type { HttpApiRequestInit } from "../../core/http/types.js";

export const MACHINE_TTS_PROVIDERS_PATH = CAVI_CONTROL_API_ENDPOINTS.portals.machine.ttsProviders;
export const MACHINE_TTS_PATH = CAVI_CONTROL_API_ENDPOINTS.portals.machine.tts;

export type MachineTtsProviderVoiceLike = {
  id: string;
  name?: string;
};

export type MachineTtsProviderLike = {
  id: string;
  label?: string;
  name?: string;
  configured?: boolean;
  voices?: readonly (MachineTtsProviderVoiceLike | string)[];
};

export type MachineTtsDashboardVoiceLike = {
  current_voice_id?: string;
  currentVoiceId?: string;
  current_voice_name?: string;
  currentVoiceName?: string;
  target_voice?: string;
  targetVoice?: string;
};

export type MachineTtsVoiceOption = {
  value: string;
  label: string;
  detail?: string;
  source: "gateway" | "dashboard";
  voiceId: string;
  providerId?: string;
  providerLabel?: string;
  agentKey?: string;
};

export type MachineTtsAgentVoiceAssignment = {
  agentKey: string;
  voiceValue: string;
  voiceId: string;
  voiceLabel: string;
  providerId?: string;
  providerLabel?: string;
  assignedAt: string;
};

export type MachineTtsJsonRequester = <T>(path: string) => Promise<T>;

export type MachineTtsBlobRequester = (
  path: string,
  init?: Pick<HttpApiRequestInit, "body" | "headers" | "method">,
) => Promise<Blob>;

export type MachineTtsAudioTransport = {
  requestBlob: MachineTtsBlobRequester;
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getMachineTtsProviderLabel(provider: MachineTtsProviderLike): string {
  return cleanString(provider.label) || cleanString(provider.name) || provider.id;
}

function dashboardVoiceId(voice: MachineTtsDashboardVoiceLike): string {
  return cleanString(voice.current_voice_id) || cleanString(voice.currentVoiceId);
}

function dashboardVoiceLabel(
  agentKey: string,
  voice: MachineTtsDashboardVoiceLike,
): string {
  return (
    cleanString(voice.current_voice_name) ||
    cleanString(voice.currentVoiceName) ||
    cleanString(voice.target_voice) ||
    cleanString(voice.targetVoice) ||
    agentKey
  );
}

export function buildMachineTtsVoiceOptions(params: {
  providers?: readonly MachineTtsProviderLike[];
  activeProviderId?: string;
  dashboardVoices?: Record<string, MachineTtsDashboardVoiceLike>;
}): MachineTtsVoiceOption[] {
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
    return getMachineTtsProviderLabel(a).localeCompare(getMachineTtsProviderLabel(b));
  });

  const gatewayOptions = new Map<string, MachineTtsVoiceOption>();
  for (const provider of providers) {
    const providerId = cleanString(provider.id);
    if (!providerId || !Array.isArray(provider.voices)) continue;
    const providerLabel = getMachineTtsProviderLabel(provider);
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

export function createMachineTtsAgentVoiceAssignment(params: {
  agentKey: string;
  voice: MachineTtsVoiceOption;
  assignedAt?: string;
}): MachineTtsAgentVoiceAssignment {
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

export function requestMachineTtsProviders(
  requestJson: MachineTtsJsonRequester,
): Promise<unknown> {
  return requestJson<unknown>(MACHINE_TTS_PROVIDERS_PATH);
}

export async function requestMachineTtsAudio(
  transport: MachineTtsAudioTransport,
  body: { text: string; voiceId?: string },
): Promise<Blob> {
  const text = body.text.trim();
  if (!text) {
    throw new Error("Enter text to synthesize.");
  }

  return transport.requestBlob(MACHINE_TTS_PATH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: {
      text,
      ...(body.voiceId ? { voiceId: body.voiceId } : {}),
    },
  });
}
