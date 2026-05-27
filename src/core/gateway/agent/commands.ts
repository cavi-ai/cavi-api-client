/**
 * Gateway-agnostic chat slash-command + mention parsing.
 *
 * The authoritative command catalog is owned by the gateway and surfaced on the
 * capabilities snapshot (`capabilities.commands`). Use {@link extractGatewayCommandCatalog}
 * to read it and pass the result as the `coreCommands` option so built-ins stay
 * dynamic rather than manually maintained. {@link FALLBACK_CORE_SLASH_COMMANDS}
 * is an offline-only safety net used when the gateway snapshot is unavailable.
 */

export type AgentCommandShortcut = {
  id: string;
  label: string;
  insert: string;
  description?: string;
};

export type AgentMentionSuggestion = {
  id: string;
  label: string;
  insert: string;
};

export type AgentCommandSource = {
  id?: string | null;
  name?: string | null;
  commands?: unknown;
  slashCommands?: unknown;
  slash_commands?: unknown;
  commandRegistry?: unknown;
  command_registry?: unknown;
  routing?: unknown;
  config?: unknown;
  snapshot?: unknown;
  orchestration?: unknown;
  triggers?: readonly unknown[] | null;
};

export type AgentCommandSurface = {
  slashShortcuts: AgentCommandShortcut[];
  mentionChips: AgentMentionSuggestion[];
};

/** Shape of a single entry in the gateway capabilities `commands` catalog. */
export type GatewayCommandSpec = {
  command?: string;
  name?: string;
  id?: string;
  insert?: string;
  template?: string;
  description?: string;
  summary?: string;
  help?: string;
  category?: string;
  aliases?: readonly string[];
  params?: readonly Record<string, unknown>[];
  arguments?: readonly Record<string, unknown>[];
  examples?: readonly string[];
  enabled?: boolean;
  source?: string;
  scope?: string;
  metadata?: Record<string, unknown>;
};

export type GatewayCommandCatalog =
  | readonly (GatewayCommandSpec | string)[]
  | {
      commands?: unknown;
      slashCommands?: unknown;
      slash_commands?: unknown;
      core?: unknown;
      agent?: unknown;
      teams?: unknown;
    };

export type GatewayCommandCapabilities = {
  commands?: GatewayCommandCatalog;
  slashCommands?: GatewayCommandCatalog;
  slash_commands?: GatewayCommandCatalog;
  commandCatalog?: GatewayCommandCatalog;
  command_catalog?: GatewayCommandCatalog;
};

/**
 * Offline-only fallback for the gateway built-in slash commands. The live
 * catalog comes from {@link extractGatewayCommandCatalog}; this is only used
 * when the capabilities snapshot has not been fetched yet.
 */
export const FALLBACK_CORE_SLASH_COMMANDS: readonly AgentCommandShortcut[] = [
  { id: "help", label: "/help", insert: "/help", description: "Short help summary from the gateway" },
  { id: "commands", label: "/commands", insert: "/commands", description: "Live command catalog for this session" },
  { id: "agent", label: "/agent", insert: "/agent ", description: "Show or switch the active agent" },
  { id: "session", label: "/session", insert: "/session", description: "Show the current session binding" },
  { id: "status", label: "/status", insert: "/status", description: "Gateway, runtime, and provider usage status" },
  { id: "tools", label: "/tools", insert: "/tools", description: "Tools the active agent can use right now" },
  { id: "new", label: "/new", insert: "/new", description: "Start a new session (alias: /reset)" },
  { id: "stop", label: "/stop", insert: "/stop", description: "Abort the current run" },
  { id: "model", label: "/model", insert: "/model", description: "Show or set the active model" },
  { id: "think", label: "/think", insert: "/think ", description: "Set thinking level (e.g. low|medium|high)" },
  { id: "verbose", label: "/verbose", insert: "/verbose ", description: "Toggle verbose output (on|off|full)" },
  { id: "queue", label: "/queue", insert: "/queue ", description: "Manage queue behavior (steer|interrupt|...)" },
  { id: "skill", label: "/skill", insert: "/skill ", description: "Run a skill by name" },
  { id: "focus", label: "/focus", insert: "/focus ", description: "Bind this thread to an agent target" },
  { id: "unfocus", label: "/unfocus", insert: "/unfocus", description: "Remove the current thread binding" },
  { id: "whoami", label: "/whoami", insert: "/whoami", description: "Show your sender id" },
];

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanInsertString(value: unknown): string {
  return typeof value === "string" ? value.trimStart() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 72) || "command";
}

function commandHead(value: string): string {
  return value.split(/\s+/u)[0] ?? value;
}

function agentLabel(agent: AgentCommandSource | null | undefined): string {
  return cleanString(agent?.name) || cleanString(agent?.id) || "agent";
}

function firstString(
  record: Record<string, unknown>,
  keys: readonly string[],
): string {
  for (const key of keys) {
    const value = cleanString(record[key]);
    if (value) return value;
  }
  return "";
}

function firstInsertString(
  record: Record<string, unknown>,
  keys: readonly string[],
): string {
  for (const key of keys) {
    const value = cleanInsertString(record[key]);
    if (value.trim()) return value;
  }
  return "";
}

function normalizeSlashTrigger(
  agent: AgentCommandSource | null | undefined,
  raw: unknown,
): AgentCommandShortcut | null {
  const trigger = cleanString(raw);
  if (!trigger.startsWith("/")) return null;
  const label = commandHead(trigger);
  if (label.length <= 1) return null;
  const suffix = trigger.slice(label.length).trim();
  const agentId = cleanString(agent?.id) || agentLabel(agent);
  return {
    id: `agent_${stableSlug(agentId)}_${stableSlug(trigger)}`,
    label,
    insert: trigger.endsWith(" ") ? trigger : suffix ? trigger : label,
    description: suffix
      ? `${agentLabel(agent)} preset: ${suffix}`
      : `${agentLabel(agent)} command`,
  };
}

const COMMAND_VALUE_KEYS = [
  "command",
  "cmd",
  "slashCommand",
  "slash_command",
  "insert",
  "template",
  "prefill",
  "value",
  "name",
  "id",
] as const;

const COMMAND_DESCRIPTION_KEYS = [
  "description",
  "summary",
  "help",
  "hint",
  "label",
] as const;

const COMMAND_SOURCE_KEYS = [
  "commands",
  "slashCommands",
  "slash_commands",
  "commandRegistry",
  "command_registry",
  "command",
  "cmd",
  "slashCommand",
  "slash_command",
  "commandModifier",
  "command_modifier",
] as const;

const COMMAND_SECTION_KEYS = [
  "routing",
  "config",
  "snapshot",
  "orchestration",
  "metadata",
  "profile",
] as const;

const MENTION_SOURCE_KEYS = [
  "triggers",
  "mentions",
  "mentionTriggers",
  "mention_triggers",
  "aliases",
  "keywords",
] as const;

function normalizeSlashCommandEntry(
  agent: AgentCommandSource | null | undefined,
  raw: unknown,
): AgentCommandShortcut | null {
  if (typeof raw === "string") {
    return normalizeSlashTrigger(agent, raw);
  }
  if (!isRecord(raw)) {
    return null;
  }
  const insertCandidate = firstInsertString(raw, ["insert", "template", "prefill"]);
  const commandCandidate = firstString(raw, COMMAND_VALUE_KEYS);
  const command =
    insertCandidate.startsWith("/")
      ? insertCandidate
      : commandCandidate.startsWith("/")
        ? commandCandidate
        : "";
  const shortcut = normalizeSlashTrigger(agent, command);
  if (!shortcut) return null;

  const description = firstString(raw, COMMAND_DESCRIPTION_KEYS);
  if (!description || description.startsWith("/")) {
    return shortcut;
  }
  return {
    ...shortcut,
    description,
  };
}

function collectCommandEntries(value: unknown, out: unknown[]): void {
  if (value == null) return;
  if (Array.isArray(value)) {
    for (const entry of value) collectCommandEntries(entry, out);
    return;
  }
  if (!isRecord(value)) {
    out.push(value);
    return;
  }
  if (COMMAND_VALUE_KEYS.some((key) => cleanString(value[key]))) {
    out.push(value);
    return;
  }
  for (const entry of Object.values(value)) {
    collectCommandEntries(entry, out);
  }
}

function collectCapabilityCommandEntries(value: unknown, out: unknown[]): void {
  if (value == null) return;
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectCapabilityCommandEntries(entry, out);
    }
    return;
  }
  if (!isRecord(value)) {
    out.push(value);
    return;
  }
  if (COMMAND_VALUE_KEYS.some((key) => cleanString(value[key]))) {
    out.push(value);
    return;
  }
  for (const key of [
    "commands",
    "slashCommands",
    "slash_commands",
    "core",
    "agent",
    "teams",
  ] as const) {
    collectCapabilityCommandEntries(value[key], out);
  }
}

function collectCommandSections(value: unknown, out: unknown[], depth = 0): void {
  if (!isRecord(value) || depth > 3) return;
  for (const key of COMMAND_SOURCE_KEYS) {
    collectCommandEntries(value[key], out);
  }
  for (const key of COMMAND_SECTION_KEYS) {
    collectCommandSections(value[key], out, depth + 1);
  }
}

function collectSlashCommandEntries(
  agent: AgentCommandSource | null | undefined,
): unknown[] {
  const out: unknown[] = [];
  collectCommandEntries(agent?.triggers, out);
  collectCommandSections(agent, out);

  const agentId = cleanString(agent?.id);
  if (agentId) {
    const label = agentLabel(agent);
    out.push(
      {
        command: `/agent ${agentId}`,
        description: `Switch command context to ${label}`,
      },
      {
        command: `/focus ${agentId}`,
        description: `Bind this thread to ${label}`,
      },
    );
  }

  return out;
}

function collectMentionEntries(
  agent: AgentCommandSource | null | undefined,
): unknown[] {
  const out: unknown[] = [];
  if (!isRecord(agent)) {
    return out;
  }
  const record = agent as Record<string, unknown>;
  for (const key of MENTION_SOURCE_KEYS) {
    collectCommandEntries(record[key], out);
  }
  return out;
}

function normalizeMentionTrigger(
  agent: AgentCommandSource | null | undefined,
  raw: unknown,
): AgentMentionSuggestion | null {
  const trigger = cleanString(raw);
  if (!trigger || trigger.startsWith("/")) return null;
  const agentId = cleanString(agent?.id) || agentLabel(agent);
  return {
    id: `mention_${stableSlug(agentId)}_${stableSlug(trigger)}`,
    label: trigger,
    insert: trigger.endsWith(" ") ? trigger : `${trigger} `,
  };
}

function pushUniqueShortcut(
  out: AgentCommandShortcut[],
  seen: Set<string>,
  shortcut: AgentCommandShortcut,
): void {
  const key = `${shortcut.label.toLowerCase()} ${shortcut.insert.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push(shortcut);
}

function pushUniqueMention(
  out: AgentMentionSuggestion[],
  seen: Set<string>,
  chip: AgentMentionSuggestion,
): void {
  const key = chip.insert.trim().toLowerCase();
  if (!key || seen.has(key)) return;
  seen.add(key);
  out.push(chip);
}

/**
 * Read the gateway built-in command catalog from a capabilities snapshot
 * (`capabilities.commands`). Returns an empty list when the gateway has not
 * surfaced a catalog yet, so callers can decide whether to fall back.
 */
export function extractGatewayCommandCatalog(capabilities: unknown): AgentCommandShortcut[] {
  if (!isRecord(capabilities)) return [];
  const entries: unknown[] = [];
  for (const key of [
    "commands",
    "slashCommands",
    "slash_commands",
    "commandCatalog",
    "command_catalog",
    "features",
  ] as const) {
    collectCapabilityCommandEntries(capabilities[key], entries);
  }
  if (entries.length === 0) return [];
  const seen = new Set<string>();
  const out: AgentCommandShortcut[] = [];
  for (const entry of entries) {
    const command =
      typeof entry === "string"
        ? cleanString(entry)
        : isRecord(entry)
          ? firstInsertString(entry, ["command", "name", "id", "insert", "template", "prefill"])
          : "";
    const insert = command.startsWith("/") ? command : command ? `/${command}` : "";
    if (!insert) continue;
    const label = commandHead(insert);
    if (label.length <= 1) continue;
    const description = isRecord(entry)
      ? firstString(entry, COMMAND_DESCRIPTION_KEYS)
      : "";
    const shortcut: AgentCommandShortcut = {
      id: `core_${stableSlug(insert)}`,
      label,
      insert,
      ...(description && !description.startsWith("/") ? { description } : {}),
    };
    pushUniqueShortcut(out, seen, shortcut);
  }
  return out;
}

export type BuildAgentSlashShortcutsOptions = {
  /** Gateway built-ins (from {@link extractGatewayCommandCatalog}); defaults to the offline fallback. */
  coreCommands?: readonly AgentCommandShortcut[];
};

export function buildAgentSlashShortcuts(
  agent: AgentCommandSource | null | undefined,
  options: BuildAgentSlashShortcutsOptions = {},
): AgentCommandShortcut[] {
  const core = options.coreCommands ?? FALLBACK_CORE_SLASH_COMMANDS;
  const seen = new Set<string>();
  const out: AgentCommandShortcut[] = [];
  for (const shortcut of core) {
    pushUniqueShortcut(out, seen, shortcut);
  }
  for (const entry of collectSlashCommandEntries(agent)) {
    const shortcut = normalizeSlashCommandEntry(agent, entry);
    if (shortcut) pushUniqueShortcut(out, seen, shortcut);
  }
  return out;
}

export function buildAgentMentionChips(
  agent: AgentCommandSource | null | undefined,
): AgentMentionSuggestion[] {
  const seen = new Set<string>();
  const out: AgentMentionSuggestion[] = [];
  for (const trigger of collectMentionEntries(agent)) {
    const chip = normalizeMentionTrigger(agent, trigger);
    if (chip) pushUniqueMention(out, seen, chip);
  }
  return out;
}

export function buildAgentCommandSurface(
  agent: AgentCommandSource | null | undefined,
  options: BuildAgentSlashShortcutsOptions = {},
): AgentCommandSurface {
  return {
    slashShortcuts: buildAgentSlashShortcuts(agent, options),
    mentionChips: buildAgentMentionChips(agent),
  };
}
