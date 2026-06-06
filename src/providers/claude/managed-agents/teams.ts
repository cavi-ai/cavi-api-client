import type {
  ManifestMember,
  ManifestTeam,
  TeamManifest,
} from "../../../contracts/team-manifest.js";
import { ApiClientError, ApiClientErrorCode } from "../../../core/errors.js";
import type {
  CreateManagedAgentParams,
  ManagedAgentAgent,
} from "./client.js";

/**
 * Map a CAVI `TeamManifest` onto Anthropic Managed Agents — option B, the
 * "teams" layer built on top of option A's `ClaudeManagedAgentClient`.
 *
 * THE MAPPING IS THE ORG CHART, NOT THE BEHAVIOR. A `TeamManifest` carries
 * topology + identity (teams → members → name/slug/capabilities) and gateway
 * HTTP routing — it deliberately does NOT carry the model, system prompt, or
 * tools an Anthropic Agent requires. So:
 *   - `ManifestTeam`   → a coordinator agent (`multiagent: {type:"coordinator"}`)
 *   - `ManifestMember` → a roster agent the coordinator may delegate to
 * …and each agent's behavior config (model/system/tools/…) is supplied
 * separately, via per-member/team manifest metadata (`metadata.<configKey>`) or
 * the `defaults` passed here. Model is required by Managed Agents; if none can be
 * resolved for a member or coordinator, provisioning throws rather than guessing.
 */

/** Behavior config an Anthropic Agent needs but a TeamManifest does not carry. */
export type ClaudeAgentConfig = {
  model?: string;
  system?: string;
  description?: string;
  tools?: readonly Record<string, unknown>[];
  mcpServers?: readonly Record<string, unknown>[];
  skills?: readonly Record<string, unknown>[];
};

export type ManagedAgentTeamMappingOptions = {
  /** Behavior-config defaults merged under every roster member (e.g. a house model). */
  memberDefaults?: ClaudeAgentConfig;
  /** Behavior-config defaults merged under every team coordinator. */
  coordinatorDefaults?: ClaudeAgentConfig;
  /** Metadata key on a manifest member/team carrying its `ClaudeAgentConfig`. Default `"claude"`. */
  configKey?: string;
};

export type ManagedAgentMemberPlan = {
  memberId: string;
  agent: CreateManagedAgentParams;
};

export type ManagedAgentTeamPlan = {
  teamId: string;
  members: readonly ManagedAgentMemberPlan[];
  /** Coordinator spec WITHOUT `multiagent` — the roster is filled with member agent ids at provision time. */
  coordinator: CreateManagedAgentParams;
};

export type ManagedAgentTeamsPlan = {
  teams: readonly ManagedAgentTeamPlan[];
};

export type ProvisionedManagedAgentMember = {
  memberId: string;
  agentId: string;
  version?: number;
};

export type ProvisionedManagedAgentTeam = {
  teamId: string;
  coordinatorAgentId: string;
  coordinatorVersion?: number;
  members: readonly ProvisionedManagedAgentMember[];
};

export type ProvisionedManagedAgentTeams = {
  teams: readonly ProvisionedManagedAgentTeam[];
};

/** Minimal client surface the provisioner needs — eases testing with a fake. */
export interface ManagedAgentCreator {
  createAgent(params: CreateManagedAgentParams): Promise<ManagedAgentAgent>;
}

const DEFAULT_CONFIG_KEY = "claude";

function readConfig(
  metadata: Record<string, unknown> | null | undefined,
  configKey: string,
): ClaudeAgentConfig {
  const value = metadata?.[configKey];
  return value && typeof value === "object" ? (value as ClaudeAgentConfig) : {};
}

function mergeConfig(base: ClaudeAgentConfig, override: ClaudeAgentConfig): ClaudeAgentConfig {
  return {
    ...(override.model ?? base.model ? { model: override.model ?? base.model } : {}),
    ...(override.system ?? base.system ? { system: override.system ?? base.system } : {}),
    ...(override.description ?? base.description
      ? { description: override.description ?? base.description }
      : {}),
    ...(override.tools ?? base.tools ? { tools: override.tools ?? base.tools } : {}),
    ...(override.mcpServers ?? base.mcpServers
      ? { mcpServers: override.mcpServers ?? base.mcpServers }
      : {}),
    ...(override.skills ?? base.skills ? { skills: override.skills ?? base.skills } : {}),
  };
}

function identityName(
  identity: ManifestTeam["identity"] | ManifestMember["identity"],
  fallback: string,
): string {
  return identity?.displayName?.trim() || identity?.name?.trim() || fallback;
}

function requireModel(config: ClaudeAgentConfig, label: string): string {
  const model = config.model?.trim();
  if (!model) {
    throw new ApiClientError(
      `claude managed-agents: no model resolved for ${label} — supply it via manifest metadata.<configKey>.model or options defaults (a TeamManifest does not carry model/system/tools)`,
      { code: ApiClientErrorCode.ValidationFailed },
    );
  }
  return model;
}

function agentParamsFromConfig(
  name: string,
  config: ClaudeAgentConfig,
  label: string,
  metadata: Record<string, unknown>,
): CreateManagedAgentParams {
  return {
    name,
    model: requireModel(config, label),
    ...(config.system ? { system: config.system } : {}),
    ...(config.description ? { description: config.description } : {}),
    ...(config.tools?.length ? { tools: config.tools } : {}),
    ...(config.mcpServers?.length ? { mcpServers: config.mcpServers } : {}),
    ...(config.skills?.length ? { skills: config.skills } : {}),
    metadata,
  };
}

function memberPlan(
  team: ManifestTeam,
  member: ManifestMember,
  options: ManagedAgentTeamMappingOptions,
  configKey: string,
): ManagedAgentMemberPlan {
  const config = mergeConfig(
    options.memberDefaults ?? {},
    readConfig(member.metadata, configKey),
  );
  const name = identityName(member.identity, member.id);
  return {
    memberId: member.id,
    agent: agentParamsFromConfig(name, config, `member "${member.id}" of team "${team.id}"`, {
      team: team.id,
      member: member.id,
    }),
  };
}

function coordinatorPlan(
  team: ManifestTeam,
  options: ManagedAgentTeamMappingOptions,
  configKey: string,
): CreateManagedAgentParams {
  const config = mergeConfig(
    options.coordinatorDefaults ?? options.memberDefaults ?? {},
    readConfig(team.metadata, configKey),
  );
  const name = identityName(team.identity, team.id);
  return agentParamsFromConfig(name, config, `coordinator of team "${team.id}"`, {
    team: team.id,
    role: "coordinator",
  });
}

/**
 * Pure: turn a `TeamManifest` into a provisioning plan — one coordinator spec +
 * one roster-member spec per team. The coordinator's `multiagent` roster is left
 * empty here (member agent ids don't exist until provisioned) and filled by
 * `provisionManagedAgentTeams`.
 */
export function buildManagedAgentTeamsPlan(
  manifest: TeamManifest,
  options: ManagedAgentTeamMappingOptions = {},
): ManagedAgentTeamsPlan {
  const configKey = options.configKey?.trim() || DEFAULT_CONFIG_KEY;
  return {
    teams: manifest.teams.map((team) => ({
      teamId: team.id,
      members: (team.members ?? []).map((member) =>
        memberPlan(team, member, options, configKey),
      ),
      coordinator: coordinatorPlan(team, options, configKey),
    })),
  };
}

/**
 * Provision a `TeamManifest` as Managed Agents: create each roster member agent,
 * then create the team coordinator referencing those member ids in its
 * `multiagent` roster. Returns the created agent ids (persist them; reference by
 * id on `sessions.create` — do not re-provision per run).
 */
export async function provisionManagedAgentTeams(
  client: ManagedAgentCreator,
  manifest: TeamManifest,
  options: ManagedAgentTeamMappingOptions = {},
): Promise<ProvisionedManagedAgentTeams> {
  const plan = buildManagedAgentTeamsPlan(manifest, options);
  const teams: ProvisionedManagedAgentTeam[] = [];

  for (const teamPlan of plan.teams) {
    const members: ProvisionedManagedAgentMember[] = [];
    for (const member of teamPlan.members) {
      const created = await client.createAgent(member.agent);
      members.push({
        memberId: member.memberId,
        agentId: created.id,
        ...(typeof created.version === "number" ? { version: created.version } : {}),
      });
    }

    const coordinator = await client.createAgent({
      ...teamPlan.coordinator,
      multiagent: {
        type: "coordinator",
        agents: members.map((member) => member.agentId),
      },
    });

    teams.push({
      teamId: teamPlan.teamId,
      coordinatorAgentId: coordinator.id,
      ...(typeof coordinator.version === "number"
        ? { coordinatorVersion: coordinator.version }
        : {}),
      members,
    });
  }

  return { teams };
}
