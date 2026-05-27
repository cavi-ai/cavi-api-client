/**
 * Pure parsing for the `tts` block inside a raw agent config payload. Tolerates
 * both snake_case (native YAML) and camelCase (gateway serialisation); every
 * field is optional and the parser is fully defensive against missing data.
 */

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Voice capabilities for a single TTS provider as configured for this agent. */
export type AgentTtsProviderVoice = {
  provider: string;
  isActive: boolean;
  voiceId: string | null;
  model: string | null;
  extras?: Record<string, string | number>;
};

/** Aggregated voice configuration for an agent, parsed from its raw config payload. */
export type AgentVoiceConfig = {
  activeProvider: string | null;
  voices: AgentTtsProviderVoice[];
};

const TTS_META_KEYS = new Set(["provider"]);

export function parseAgentVoiceConfig(rawConfig: unknown): AgentVoiceConfig {
  const root = asRecord(rawConfig);

  const ttsBlock =
    asRecord(root.tts).provider !== undefined ||
    Object.keys(asRecord(root.tts)).length > 0
      ? asRecord(root.tts)
      : asRecord(asRecord(root.config).tts);

  const activeProvider = cleanString(ttsBlock.provider) || null;
  const voices: AgentTtsProviderVoice[] = [];

  for (const [key, value] of Object.entries(ttsBlock)) {
    if (TTS_META_KEYS.has(key)) continue;
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue;

    const sub = asRecord(value);

    const voiceId =
      cleanString(sub.voice_id) ||
      cleanString(sub.voiceId) ||
      cleanString(sub.voice) ||
      null;

    const model =
      cleanString(sub.model_id) ||
      cleanString(sub.modelId) ||
      cleanString(sub.model) ||
      null;

    const knownVoiceKeys = new Set(["voice_id", "voiceId", "voice", "model_id", "modelId", "model"]);
    const extras: Record<string, string | number> = {};
    for (const [subKey, subValue] of Object.entries(sub)) {
      if (knownVoiceKeys.has(subKey)) continue;
      if (typeof subValue === "string" && subValue.trim() !== "") {
        extras[subKey] = subValue.trim();
      } else if (typeof subValue === "number" && Number.isFinite(subValue)) {
        extras[subKey] = subValue;
      }
    }

    voices.push({
      provider: key,
      isActive: key === activeProvider,
      voiceId,
      model,
      ...(Object.keys(extras).length > 0 ? { extras } : {}),
    });
  }

  voices.sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return a.provider.localeCompare(b.provider);
  });

  return { activeProvider, voices };
}
