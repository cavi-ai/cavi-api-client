// OpenClaw provider manifest — the single source of truth for what the OpenClaw
// gateway exposes to clients. Mirrors the upstream canon at:
//
//   ../harness/openclaw/docs/api/providers/openclaw/api-endpoints.md
//
// (A vendored copy lives at docs/api/providers/openclaw/api-endpoints.md.)
//
// Every entry starts at `status: "doc-only"` — the wire name and scope are taken
// from the upstream registry (`CORE_GATEWAY_METHOD_SPECS` in
// src/gateway/methods/core-descriptors.ts of the openclaw repo). Param and
// response shapes are filled in as they're verified against the live gateway
// (status → "shape-verified" → "live-verified").
//
// This file is data only. `OPENCLAW_RPC_METHODS`, `OPENCLAW_CORE_RPC_METHODS`,
// and `OPENCLAW_DEFAULT_CAPABILITIES` are derived from it; never duplicate a
// method name here and there.

import type {
  GatewayScope,
  ProviderEventSpec,
  ProviderManifest,
  ProviderRestEndpoint,
  ProviderRpcMethod,
} from "../../core/gateway/providers/manifest.types.js";

const SHAPE_VERIFIED_METHODS = new Set([
  "agents.list", "models.list", "models.authStatus", "usage.status", "usage.cost",
  "sessions.list", "sessions.describe", "sessions.abort",
  "tasks.list", "tasks.get", "tasks.cancel",
]);

const SYSTEM = "System / identity / status";
const DOCTOR = "Doctor / memory";
const CHANNELS = "Channels / login / push / wake-word";
const MODELS_USAGE = "Models / usage";
const TALK_TTS = "Talk / TTS";
const CONFIG_SECRETS = "Config / secrets / wizard / update";
const AGENTS_TASKS = "Agents / workspaces / artifacts / environments / tasks";
const SESSIONS_CHAT = "Sessions / chat";
const SKILLS_TOOLS = "Skills / tools / commands";
const APPROVALS = "Approvals (exec + plugin)";
const CRON = "Cron";
const DEVICES = "Devices";
const NODES_OP = "Nodes (operator-side)";
const NODES_NODE = "Nodes (node-side, scope `node`)";
const WORKBOARD = "OpenClaw Workboard";

function m(
  method: string,
  category: string,
  scope: GatewayScope | readonly GatewayScope[],
  advertised: boolean,
  docSection: string,
  note?: string,
): ProviderRpcMethod {
  const entry: ProviderRpcMethod = {
    method,
    category,
    scope,
    advertised,
    status: SHAPE_VERIFIED_METHODS.has(method) ? "shape-verified" : "doc-only",
    docSection,
  };
  if (note) entry.note = note;
  return entry;
}

function rest(
  surface: string,
  httpMethod: ProviderRestEndpoint["method"],
  path: string,
  auth: ProviderRestEndpoint["auth"],
  docSection: string,
  note?: string,
): ProviderRestEndpoint {
  const entry: ProviderRestEndpoint = {
    surface,
    method: httpMethod,
    path,
    auth,
    status: "doc-only",
    docSection,
  };
  if (note) entry.note = note;
  return entry;
}

// --- RPC ---------------------------------------------------------------------

const RPC = {
  // System / identity / status
  health:                     m("health",                       "system",                       "operator.read",  true,  SYSTEM),
  status:                     m("status",                       "system",                       "operator.read",  true,  SYSTEM),
  diagnosticsStability:       m("diagnostics.stability",        "system",                       "operator.read",  true,  SYSTEM),
  gatewayIdentityGet:         m("gateway.identity.get",         "system",                       "operator.read",  true,  SYSTEM),
  gatewayRestartPreflight:    m("gateway.restart.preflight",    "system",                       "operator.read",  true,  SYSTEM),
  gatewayRestartRequest:      m("gateway.restart.request",      "system",                       "operator.admin", true,  SYSTEM),
  systemPresence:             m("system-presence",              "system",                       "operator.read",  true,  SYSTEM),
  systemEvent:                m("system-event",                 "system",                       "operator.admin", true,  SYSTEM),
  lastHeartbeat:              m("last-heartbeat",               "system",                       "operator.read",  true,  SYSTEM),
  setHeartbeats:              m("set-heartbeats",               "system",                       "operator.admin", true,  SYSTEM),
  logsTail:                   m("logs.tail",                    "system",                       "operator.read",  true,  SYSTEM),
  connect:                    m("connect",                      "system",                       "operator.admin", false, SYSTEM, "unadvertised"),
  poll:                       m("poll",                         "system",                       "operator.write", false, SYSTEM, "unadvertised"),

  // Doctor / memory
  doctorMemoryStatus:         m("doctor.memory.status",                 "doctor-memory",        "operator.read",  true,  DOCTOR),
  doctorMemoryDreamDiary:     m("doctor.memory.dreamDiary",             "doctor-memory",        "operator.read",  true,  DOCTOR),
  doctorMemoryRemHarness:     m("doctor.memory.remHarness",             "doctor-memory",        "operator.read",  true,  DOCTOR),
  doctorMemoryBackfillDreamDiary: m("doctor.memory.backfillDreamDiary", "doctor-memory",        "operator.write", true,  DOCTOR),
  doctorMemoryResetDreamDiary:    m("doctor.memory.resetDreamDiary",    "doctor-memory",        "operator.write", true,  DOCTOR),
  doctorMemoryResetGroundedShortTerm: m("doctor.memory.resetGroundedShortTerm", "doctor-memory","operator.write", true,  DOCTOR),
  doctorMemoryRepairDreamingArtifacts: m("doctor.memory.repairDreamingArtifacts", "doctor-memory","operator.write", true,  DOCTOR),
  doctorMemoryDedupeDreamDiary: m("doctor.memory.dedupeDreamDiary",     "doctor-memory",        "operator.write", true,  DOCTOR),

  // Channels / login / push / wake-word
  channelsStatus:             m("channels.status",              "channels-login-push-wakeword", "operator.read",  true,  CHANNELS),
  channelsStart:              m("channels.start",               "channels-login-push-wakeword", "operator.admin", true,  CHANNELS),
  channelsStop:               m("channels.stop",                "channels-login-push-wakeword", "operator.admin", true,  CHANNELS),
  channelsLogout:             m("channels.logout",              "channels-login-push-wakeword", "operator.admin", true,  CHANNELS),
  webLoginStart:              m("web.login.start",              "channels-login-push-wakeword", "operator.admin", false, CHANNELS, "unadvertised"),
  webLoginWait:               m("web.login.wait",               "channels-login-push-wakeword", "operator.admin", false, CHANNELS, "unadvertised"),
  pushTest:                   m("push.test",                    "channels-login-push-wakeword", "operator.write", false, CHANNELS, "unadvertised"),
  pushWebVapidPublicKey:      m("push.web.vapidPublicKey",      "channels-login-push-wakeword", "operator.write", false, CHANNELS, "unadvertised"),
  pushWebSubscribe:           m("push.web.subscribe",           "channels-login-push-wakeword", "operator.write", false, CHANNELS, "unadvertised"),
  pushWebUnsubscribe:         m("push.web.unsubscribe",         "channels-login-push-wakeword", "operator.write", false, CHANNELS, "unadvertised"),
  pushWebTest:                m("push.web.test",                "channels-login-push-wakeword", "operator.write", false, CHANNELS, "unadvertised"),
  voicewakeGet:               m("voicewake.get",                "channels-login-push-wakeword", "operator.read",  true,  CHANNELS),
  voicewakeSet:               m("voicewake.set",                "channels-login-push-wakeword", "operator.write", true,  CHANNELS),
  voicewakeRoutingGet:        m("voicewake.routing.get",        "channels-login-push-wakeword", "operator.read",  true,  CHANNELS),
  voicewakeRoutingSet:        m("voicewake.routing.set",        "channels-login-push-wakeword", "operator.write", true,  CHANNELS),

  // Models / usage
  modelsList:                 m("models.list",                  "models-usage",                 "operator.read",  true,  MODELS_USAGE),
  modelsAuthStatus:           m("models.authStatus",            "models-usage",                 "operator.read",  true,  MODELS_USAGE),
  modelsAuthLogout:           m("models.authLogout",            "models-usage",                 "operator.admin", true,  MODELS_USAGE),
  usageStatus:                m("usage.status",                 "models-usage",                 "operator.read",  true,  MODELS_USAGE),
  usageCost:                  m("usage.cost",                   "models-usage",                 "operator.read",  true,  MODELS_USAGE),

  // Talk / TTS
  talkCatalog:                m("talk.catalog",                 "talk-tts",                     "operator.read",  true,  TALK_TTS),
  talkConfig:                 m("talk.config",                  "talk-tts",                     "operator.read",  true,  TALK_TTS, "secrets only with operator.talk.secrets (or operator.admin)"),
  talkClientCreate:           m("talk.client.create",           "talk-tts",                     "operator.write", true,  TALK_TTS),
  talkClientToolCall:         m("talk.client.toolCall",         "talk-tts",                     "operator.write", true,  TALK_TTS),
  talkClientSteer:            m("talk.client.steer",            "talk-tts",                     "operator.write", true,  TALK_TTS),
  talkSessionCreate:          m("talk.session.create",          "talk-tts",                     "operator.write", true,  TALK_TTS),
  talkSessionJoin:            m("talk.session.join",            "talk-tts",                     "operator.write", true,  TALK_TTS),
  talkSessionAppendAudio:     m("talk.session.appendAudio",     "talk-tts",                     "operator.write", true,  TALK_TTS),
  talkSessionStartTurn:       m("talk.session.startTurn",       "talk-tts",                     "operator.write", true,  TALK_TTS),
  talkSessionEndTurn:         m("talk.session.endTurn",         "talk-tts",                     "operator.write", true,  TALK_TTS),
  talkSessionCancelTurn:      m("talk.session.cancelTurn",      "talk-tts",                     "operator.write", true,  TALK_TTS),
  talkSessionCancelOutput:    m("talk.session.cancelOutput",    "talk-tts",                     "operator.write", true,  TALK_TTS),
  talkSessionSubmitToolResult: m("talk.session.submitToolResult","talk-tts",                    "operator.write", true,  TALK_TTS),
  talkSessionSteer:           m("talk.session.steer",           "talk-tts",                     "operator.write", true,  TALK_TTS),
  talkSessionClose:           m("talk.session.close",           "talk-tts",                     "operator.write", true,  TALK_TTS),
  talkSpeak:                  m("talk.speak",                   "talk-tts",                     "operator.write", true,  TALK_TTS),
  talkMode:                   m("talk.mode",                    "talk-tts",                     "operator.write", true,  TALK_TTS),
  ttsStatus:                  m("tts.status",                   "talk-tts",                     "operator.read",  true,  TALK_TTS),
  ttsProviders:               m("tts.providers",                "talk-tts",                     "operator.read",  true,  TALK_TTS),
  ttsPersonas:                m("tts.personas",                 "talk-tts",                     "operator.read",  true,  TALK_TTS),
  ttsEnable:                  m("tts.enable",                   "talk-tts",                     "operator.write", true,  TALK_TTS),
  ttsDisable:                 m("tts.disable",                  "talk-tts",                     "operator.write", true,  TALK_TTS),
  ttsConvert:                 m("tts.convert",                  "talk-tts",                     "operator.write", true,  TALK_TTS),
  ttsSetProvider:             m("tts.setProvider",              "talk-tts",                     "operator.write", true,  TALK_TTS),
  ttsSetPersona:              m("tts.setPersona",               "talk-tts",                     "operator.write", true,  TALK_TTS),

  // Config / secrets / wizard / update
  configGet:                  m("config.get",                   "config-secrets-wizard-update", "operator.read",  true,  CONFIG_SECRETS),
  configSet:                  m("config.set",                   "config-secrets-wizard-update", "operator.admin", true,  CONFIG_SECRETS),
  configApply:                m("config.apply",                 "config-secrets-wizard-update", "operator.admin", true,  CONFIG_SECRETS),
  configPatch:                m("config.patch",                 "config-secrets-wizard-update", "operator.admin", true,  CONFIG_SECRETS),
  configSchema:               m("config.schema",                "config-secrets-wizard-update", "operator.admin", true,  CONFIG_SECRETS),
  configSchemaLookup:         m("config.schema.lookup",         "config-secrets-wizard-update", "operator.read",  true,  CONFIG_SECRETS),
  configOpenFile:             m("config.openFile",              "config-secrets-wizard-update", "operator.admin", false, CONFIG_SECRETS, "unadvertised"),
  secretsReload:              m("secrets.reload",               "config-secrets-wizard-update", "operator.admin", true,  CONFIG_SECRETS),
  secretsResolve:             m("secrets.resolve",              "config-secrets-wizard-update", "operator.admin", true,  CONFIG_SECRETS),
  wizardStart:                m("wizard.start",                 "config-secrets-wizard-update", "operator.admin", true,  CONFIG_SECRETS),
  wizardNext:                 m("wizard.next",                  "config-secrets-wizard-update", "operator.admin", true,  CONFIG_SECRETS),
  wizardStatus:               m("wizard.status",                "config-secrets-wizard-update", "operator.admin", true,  CONFIG_SECRETS),
  wizardCancel:               m("wizard.cancel",                "config-secrets-wizard-update", "operator.admin", true,  CONFIG_SECRETS),
  updateStatus:               m("update.status",                "config-secrets-wizard-update", "operator.admin", true,  CONFIG_SECRETS),
  updateRun:                  m("update.run",                   "config-secrets-wizard-update", "operator.admin", true,  CONFIG_SECRETS),

  // Agents / workspaces / artifacts / environments / tasks
  agentsList:                 m("agents.list",                  "agents-tasks-artifacts-environments", "operator.read",  true,  AGENTS_TASKS),
  agentsCreate:               m("agents.create",                "agents-tasks-artifacts-environments", "operator.admin", true,  AGENTS_TASKS),
  agentsUpdate:               m("agents.update",                "agents-tasks-artifacts-environments", "operator.admin", true,  AGENTS_TASKS),
  agentsDelete:               m("agents.delete",                "agents-tasks-artifacts-environments", "operator.admin", true,  AGENTS_TASKS),
  agentsFilesList:            m("agents.files.list",            "agents-tasks-artifacts-environments", "operator.read",  true,  AGENTS_TASKS),
  agentsFilesGet:             m("agents.files.get",             "agents-tasks-artifacts-environments", "operator.read",  true,  AGENTS_TASKS),
  agentsFilesSet:             m("agents.files.set",             "agents-tasks-artifacts-environments", "operator.admin", true,  AGENTS_TASKS),
  artifactsList:              m("artifacts.list",               "agents-tasks-artifacts-environments", "operator.read",  true,  AGENTS_TASKS),
  artifactsGet:               m("artifacts.get",                "agents-tasks-artifacts-environments", "operator.read",  true,  AGENTS_TASKS),
  artifactsDownload:          m("artifacts.download",           "agents-tasks-artifacts-environments", "operator.read",  true,  AGENTS_TASKS),
  environmentsList:           m("environments.list",            "agents-tasks-artifacts-environments", "operator.read",  true,  AGENTS_TASKS),
  environmentsStatus:         m("environments.status",          "agents-tasks-artifacts-environments", "operator.read",  true,  AGENTS_TASKS),
  tasksList:                  m("tasks.list",                   "agents-tasks-artifacts-environments", "operator.read",  true,  AGENTS_TASKS),
  tasksGet:                   m("tasks.get",                    "agents-tasks-artifacts-environments", "operator.read",  true,  AGENTS_TASKS),
  tasksCancel:                m("tasks.cancel",                 "agents-tasks-artifacts-environments", "operator.write", true,  AGENTS_TASKS),
  agentIdentityGet:           m("agent.identity.get",           "agents-tasks-artifacts-environments", "operator.read",  true,  AGENTS_TASKS),
  agentWait:                  m("agent.wait",                   "agents-tasks-artifacts-environments", "operator.write", true,  AGENTS_TASKS),
  agent:                      m("agent",                        "agents-tasks-artifacts-environments", "operator.write", true,  AGENTS_TASKS),
  messageAction:              m("message.action",               "agents-tasks-artifacts-environments", "operator.write", true,  AGENTS_TASKS),

  // Sessions / chat
  sessionsList:               m("sessions.list",                "sessions-chat",                "operator.read",  true,  SESSIONS_CHAT),
  sessionsSubscribe:          m("sessions.subscribe",           "sessions-chat",                "operator.read",  true,  SESSIONS_CHAT),
  sessionsUnsubscribe:        m("sessions.unsubscribe",         "sessions-chat",                "operator.read",  true,  SESSIONS_CHAT),
  sessionsMessagesSubscribe:  m("sessions.messages.subscribe",  "sessions-chat",                "operator.read",  true,  SESSIONS_CHAT),
  sessionsMessagesUnsubscribe:m("sessions.messages.unsubscribe","sessions-chat",                "operator.read",  true,  SESSIONS_CHAT),
  sessionsPreview:            m("sessions.preview",             "sessions-chat",                "operator.read",  true,  SESSIONS_CHAT),
  sessionsDescribe:           m("sessions.describe",            "sessions-chat",                "operator.read",  true,  SESSIONS_CHAT),
  sessionsCompactionList:     m("sessions.compaction.list",     "sessions-chat",                "operator.read",  true,  SESSIONS_CHAT),
  sessionsCompactionGet:      m("sessions.compaction.get",      "sessions-chat",                "operator.read",  true,  SESSIONS_CHAT),
  sessionsCompactionBranch:   m("sessions.compaction.branch",   "sessions-chat",                "operator.write", true,  SESSIONS_CHAT),
  sessionsCompactionRestore:  m("sessions.compaction.restore",  "sessions-chat",                "operator.admin", true,  SESSIONS_CHAT),
  sessionsCreate:             m("sessions.create",              "sessions-chat",                "operator.write", true,  SESSIONS_CHAT),
  sessionsSend:               m("sessions.send",                "sessions-chat",                "operator.write", true,  SESSIONS_CHAT),
  sessionsAbort:              m("sessions.abort",               "sessions-chat",                "operator.write", true,  SESSIONS_CHAT),
  sessionsPatch:              m("sessions.patch",               "sessions-chat",                "operator.admin", true,  SESSIONS_CHAT),
  sessionsPluginPatch:        m("sessions.pluginPatch",         "sessions-chat",                "operator.admin", true,  SESSIONS_CHAT),
  sessionsCleanup:            m("sessions.cleanup",             "sessions-chat",                "operator.admin", true,  SESSIONS_CHAT),
  sessionsReset:              m("sessions.reset",               "sessions-chat",                "operator.admin", true,  SESSIONS_CHAT),
  sessionsDelete:             m("sessions.delete",              "sessions-chat",                "operator.admin", true,  SESSIONS_CHAT),
  sessionsCompact:            m("sessions.compact",             "sessions-chat",                "operator.admin", true,  SESSIONS_CHAT),
  sessionsGet:                m("sessions.get",                 "sessions-chat",                "operator.read",  false, SESSIONS_CHAT, "unadvertised"),
  sessionsResolve:            m("sessions.resolve",             "sessions-chat",                "operator.read",  false, SESSIONS_CHAT, "unadvertised"),
  sessionsUsage:              m("sessions.usage",               "sessions-chat",                "operator.read",  false, SESSIONS_CHAT, "unadvertised"),
  sessionsUsageTimeseries:    m("sessions.usage.timeseries",    "sessions-chat",                "operator.read",  false, SESSIONS_CHAT, "unadvertised"),
  sessionsUsageLogs:          m("sessions.usage.logs",          "sessions-chat",                "operator.read",  false, SESSIONS_CHAT, "unadvertised"),
  sessionsSteer:              m("sessions.steer",               "sessions-chat",                "operator.write", false, SESSIONS_CHAT, "unadvertised"),
  chatHistory:                m("chat.history",                 "sessions-chat",                "operator.read",  true,  SESSIONS_CHAT),
  chatSend:                   m("chat.send",                    "sessions-chat",                "operator.write", true,  SESSIONS_CHAT),
  chatAbort:                  m("chat.abort",                   "sessions-chat",                "operator.write", true,  SESSIONS_CHAT),
  chatInject:                 m("chat.inject",                  "sessions-chat",                "operator.admin", false, SESSIONS_CHAT, "unadvertised"),
  send:                       m("send",                         "sessions-chat",                "operator.write", true,  SESSIONS_CHAT),
  wake:                       m("wake",                         "sessions-chat",                "operator.write", true,  SESSIONS_CHAT),
  assistantMediaGet:          m("assistant.media.get",          "sessions-chat",                "operator.read",  false, SESSIONS_CHAT, "unadvertised"),

  // Skills / tools / commands
  commandsList:               m("commands.list",                "skills-tools-commands",        "operator.read",  true,  SKILLS_TOOLS),
  toolsCatalog:               m("tools.catalog",                "skills-tools-commands",        "operator.read",  true,  SKILLS_TOOLS),
  toolsEffective:             m("tools.effective",              "skills-tools-commands",        "operator.read",  true,  SKILLS_TOOLS),
  toolsInvoke:                m("tools.invoke",                 "skills-tools-commands",        "operator.write", true,  SKILLS_TOOLS),
  skillsStatus:               m("skills.status",                "skills-tools-commands",        "operator.read",  true,  SKILLS_TOOLS),
  skillsSearch:               m("skills.search",                "skills-tools-commands",        "operator.read",  true,  SKILLS_TOOLS),
  skillsDetail:               m("skills.detail",                "skills-tools-commands",        "operator.read",  true,  SKILLS_TOOLS),
  skillsBins:                 m("skills.bins",                  "skills-tools-commands",        "node",           true,  SKILLS_TOOLS),
  skillsUploadBegin:          m("skills.upload.begin",          "skills-tools-commands",        "operator.admin", true,  SKILLS_TOOLS),
  skillsUploadChunk:          m("skills.upload.chunk",          "skills-tools-commands",        "operator.admin", true,  SKILLS_TOOLS),
  skillsUploadCommit:         m("skills.upload.commit",         "skills-tools-commands",        "operator.admin", true,  SKILLS_TOOLS),
  skillsInstall:              m("skills.install",               "skills-tools-commands",        "operator.admin", true,  SKILLS_TOOLS),
  skillsUpdate:               m("skills.update",                "skills-tools-commands",        "operator.admin", true,  SKILLS_TOOLS),

  // Approvals
  execApprovalGet:            m("exec.approval.get",            "approvals",                    "operator.approvals", true, APPROVALS),
  execApprovalList:           m("exec.approval.list",           "approvals",                    "operator.approvals", true, APPROVALS),
  execApprovalRequest:        m("exec.approval.request",        "approvals",                    "operator.approvals", true, APPROVALS),
  execApprovalWaitDecision:   m("exec.approval.waitDecision",   "approvals",                    "operator.approvals", true, APPROVALS),
  execApprovalResolve:        m("exec.approval.resolve",        "approvals",                    "operator.approvals", true, APPROVALS),
  execApprovalsGet:           m("exec.approvals.get",           "approvals",                    "operator.admin",     true, APPROVALS),
  execApprovalsSet:           m("exec.approvals.set",           "approvals",                    "operator.admin",     true, APPROVALS),
  execApprovalsNodeGet:       m("exec.approvals.node.get",      "approvals",                    "operator.admin",     true, APPROVALS),
  execApprovalsNodeSet:       m("exec.approvals.node.set",      "approvals",                    "operator.admin",     true, APPROVALS),
  pluginApprovalList:         m("plugin.approval.list",         "approvals",                    "operator.approvals", true, APPROVALS),
  pluginApprovalRequest:      m("plugin.approval.request",      "approvals",                    "operator.approvals", true, APPROVALS),
  pluginApprovalWaitDecision: m("plugin.approval.waitDecision", "approvals",                    "operator.approvals", true, APPROVALS),
  pluginApprovalResolve:      m("plugin.approval.resolve",      "approvals",                    "operator.approvals", true, APPROVALS),
  pluginsUiDescriptors:       m("plugins.uiDescriptors",        "approvals",                    "operator.read",      true, APPROVALS),
  pluginsSessionAction:       m("plugins.sessionAction",        "approvals",                    "dynamic",            true, APPROVALS),

  // Cron
  cronGet:                    m("cron.get",                     "cron",                         "operator.read",  true,  CRON),
  cronList:                   m("cron.list",                    "cron",                         "operator.read",  true,  CRON),
  cronStatus:                 m("cron.status",                  "cron",                         "operator.read",  true,  CRON),
  cronRuns:                   m("cron.runs",                    "cron",                         "operator.read",  true,  CRON),
  cronAdd:                    m("cron.add",                     "cron",                         "operator.admin", true,  CRON),
  cronUpdate:                 m("cron.update",                  "cron",                         "operator.admin", true,  CRON),
  cronRemove:                 m("cron.remove",                  "cron",                         "operator.admin", true,  CRON),
  cronRun:                    m("cron.run",                     "cron",                         "operator.admin", true,  CRON),

  // Devices
  devicePairList:             m("device.pair.list",             "devices",                      "operator.pairing", true, DEVICES),
  devicePairApprove:          m("device.pair.approve",          "devices",                      "operator.pairing", true, DEVICES),
  devicePairReject:           m("device.pair.reject",           "devices",                      "operator.pairing", true, DEVICES),
  devicePairRemove:           m("device.pair.remove",           "devices",                      "operator.pairing", true, DEVICES),
  deviceTokenRotate:          m("device.token.rotate",          "devices",                      "operator.pairing", true, DEVICES),
  deviceTokenRevoke:          m("device.token.revoke",          "devices",                      "operator.pairing", true, DEVICES),

  // Nodes (operator-side)
  nodePairRequest:            m("node.pair.request",            "nodes-operator",               "operator.pairing", true, NODES_OP),
  nodePairList:               m("node.pair.list",               "nodes-operator",               "operator.pairing", true, NODES_OP),
  nodePairApprove:            m("node.pair.approve",            "nodes-operator",               "operator.pairing", true, NODES_OP),
  nodePairReject:             m("node.pair.reject",             "nodes-operator",               "operator.pairing", true, NODES_OP),
  nodePairRemove:             m("node.pair.remove",             "nodes-operator",               "operator.pairing", true, NODES_OP),
  nodePairVerify:             m("node.pair.verify",             "nodes-operator",               "operator.pairing", true, NODES_OP),
  nodeRename:                 m("node.rename",                  "nodes-operator",               "operator.pairing", true, NODES_OP),
  nodeList:                   m("node.list",                    "nodes-operator",               "operator.read",    true, NODES_OP),
  nodeDescribe:               m("node.describe",                "nodes-operator",               "operator.read",    true, NODES_OP),
  nodeInvoke:                 m("node.invoke",                  "nodes-operator",               "operator.write",   true, NODES_OP),
  nodePendingEnqueue:         m("node.pending.enqueue",         "nodes-operator",               "operator.write",   true, NODES_OP),

  // Nodes (node-side; scope `node`)
  nodePluginSurfaceRefresh:   m("node.pluginSurface.refresh",   "nodes-node",                   "node",           true,  NODES_NODE),
  nodePendingDrain:           m("node.pending.drain",           "nodes-node",                   "node",           true,  NODES_NODE),
  nodePendingPull:            m("node.pending.pull",            "nodes-node",                   "node",           true,  NODES_NODE),
  nodePendingAck:             m("node.pending.ack",             "nodes-node",                   "node",           true,  NODES_NODE),
  nodeInvokeResult:           m("node.invoke.result",           "nodes-node",                   "node",           true,  NODES_NODE),
  nodeEvent:                  m("node.event",                   "nodes-node",                   "node",           true,  NODES_NODE),
  nativeHookInvoke:           m("nativeHook.invoke",            "nodes-node",                   "operator.admin", false, NODES_NODE, "unadvertised"),

  // OpenClaw Workboard
  workboardCardsList:         m("workboard.cards.list",         "workboard",                    "operator.read",  true,  WORKBOARD),
  workboardCardsExport:       m("workboard.cards.export",       "workboard",                    "operator.read",  true,  WORKBOARD),
  workboardCardsDiagnostics:  m("workboard.cards.diagnostics",  "workboard",                    "operator.read",  true,  WORKBOARD),
  workboardCardsStats:        m("workboard.cards.stats",        "workboard",                    "operator.read",  true,  WORKBOARD),
  workboardCardsRuns:         m("workboard.cards.runs",         "workboard",                    "operator.read",  true,  WORKBOARD),
  workboardBoardsList:        m("workboard.boards.list",        "workboard",                    "operator.read",  true,  WORKBOARD),
  workboardAttachmentsList:   m("workboard.cards.attachments.list", "workboard",                "operator.read",  true,  WORKBOARD),
  workboardAttachmentsGet:    m("workboard.cards.attachments.get", "workboard",                 "operator.read",  true,  WORKBOARD),
  workboardNotificationsList: m("workboard.notifications.list", "workboard",                    "operator.read",  true,  WORKBOARD),
  workboardNotificationsEvents: m("workboard.notifications.events", "workboard",                 "operator.read",  true,  WORKBOARD),
  workboardCardsCreate:       m("workboard.cards.create",       "workboard",                    "operator.write", true,  WORKBOARD),
  workboardCardsUpdate:       m("workboard.cards.update",       "workboard",                    "operator.write", true,  WORKBOARD),
  workboardCardsMove:         m("workboard.cards.move",         "workboard",                    "operator.write", true,  WORKBOARD),
  workboardCardsDelete:       m("workboard.cards.delete",       "workboard",                    "operator.write", true,  WORKBOARD),
  workboardCardsComment:      m("workboard.cards.comment",      "workboard",                    "operator.write", true,  WORKBOARD),
  workboardCardsLink:         m("workboard.cards.link",         "workboard",                    "operator.write", true,  WORKBOARD),
  workboardCardsLinkDependency: m("workboard.cards.linkDependency", "workboard",                 "operator.write", true,  WORKBOARD),
  workboardCardsProof:        m("workboard.cards.proof",        "workboard",                    "operator.write", true,  WORKBOARD),
  workboardCardsArtifact:     m("workboard.cards.artifact",     "workboard",                    "operator.write", true,  WORKBOARD),
  workboardCardsClaim:        m("workboard.cards.claim",        "workboard",                    "operator.write", true,  WORKBOARD),
  workboardCardsHeartbeat:    m("workboard.cards.heartbeat",    "workboard",                    "operator.write", true,  WORKBOARD),
  workboardCardsRelease:      m("workboard.cards.release",      "workboard",                    "operator.write", true,  WORKBOARD),
  workboardCardsPromote:      m("workboard.cards.promote",      "workboard",                    "operator.write", true,  WORKBOARD),
  workboardCardsReassign:     m("workboard.cards.reassign",     "workboard",                    "operator.write", true,  WORKBOARD),
  workboardCardsReclaim:      m("workboard.cards.reclaim",      "workboard",                    "operator.write", true,  WORKBOARD),
  workboardCardsComplete:     m("workboard.cards.complete",     "workboard",                    "operator.write", true,  WORKBOARD),
  workboardCardsBlock:        m("workboard.cards.block",        "workboard",                    "operator.write", true,  WORKBOARD),
  workboardCardsUnblock:      m("workboard.cards.unblock",      "workboard",                    "operator.write", true,  WORKBOARD),
  workboardCardsBulk:         m("workboard.cards.bulk",         "workboard",                    "operator.write", true,  WORKBOARD),
  workboardCardsDiagnosticsRefresh: m("workboard.cards.diagnostics.refresh", "workboard",        "operator.write", true,  WORKBOARD),
  workboardCardsDispatch:     m("workboard.cards.dispatch",     "workboard",                    "operator.write", true,  WORKBOARD),
  workboardCardsSpecify:      m("workboard.cards.specify",      "workboard",                    "operator.write", true,  WORKBOARD),
  workboardCardsDecompose:    m("workboard.cards.decompose",    "workboard",                    "operator.write", true,  WORKBOARD),
  workboardCardsArchive:      m("workboard.cards.archive",      "workboard",                    "operator.write", true,  WORKBOARD),
  workboardBoardsUpsert:      m("workboard.boards.upsert",      "workboard",                    "operator.write", true,  WORKBOARD),
  workboardBoardsArchive:     m("workboard.boards.archive",     "workboard",                    "operator.write", true,  WORKBOARD),
  workboardBoardsDelete:      m("workboard.boards.delete",      "workboard",                    "operator.write", true,  WORKBOARD),
  workboardNotificationsSubscribe: m("workboard.notifications.subscribe", "workboard",           "operator.write", true,  WORKBOARD),
  workboardNotificationsDelete: m("workboard.notifications.delete", "workboard",                 "operator.write", true,  WORKBOARD),
  workboardNotificationsAdvance: m("workboard.notifications.advance", "workboard",               "operator.write", true,  WORKBOARD),
  workboardAttachmentsAdd:    m("workboard.cards.attachments.add", "workboard",                  "operator.write", true,  WORKBOARD),
  workboardAttachmentsDelete: m("workboard.cards.attachments.delete", "workboard",               "operator.write", true,  WORKBOARD),
  workboardWorkerLog:         m("workboard.cards.workerLog",    "workboard",                    "operator.write", true,  WORKBOARD),
  workboardProtocolViolation: m("workboard.cards.protocolViolation", "workboard",                "operator.write", true,  WORKBOARD),
} as const satisfies Record<string, ProviderRpcMethod>;

// --- REST --------------------------------------------------------------------

const REST_PROBE = "Liveness and readiness";
const REST_HOOKS = "Webhooks";
const REST_OPENAI = "OpenAI-compatible";
const REST_TOOLS = "Tool invocation";
const REST_SESSIONS = "Session control (HTTP)";
const REST_MANAGED_MEDIA = "Managed media";
const REST_CONTROL_UI = "Control UI";
const REST_MCP = "MCP loopback";

const REST = {
  health:                     rest("probe",             "GET",  "/health",                                  "none",              REST_PROBE),
  healthHead:                 rest("probe",             "HEAD", "/health",                                  "none",              REST_PROBE),
  healthz:                    rest("probe",             "GET",  "/healthz",                                 "none",              REST_PROBE),
  healthzHead:                rest("probe",             "HEAD", "/healthz",                                 "none",              REST_PROBE),
  ready:                      rest("probe",             "GET",  "/ready",                                   "bearer-or-header",  REST_PROBE, "Unauth remote callers get a boolean only"),
  readyHead:                  rest("probe",             "HEAD", "/ready",                                   "bearer-or-header",  REST_PROBE),
  readyz:                     rest("probe",             "GET",  "/readyz",                                  "bearer-or-header",  REST_PROBE),
  readyzHead:                 rest("probe",             "HEAD", "/readyz",                                  "bearer-or-header",  REST_PROBE),

  hooksWake:                  rest("hooks",             "POST", "<basePath>/wake",                          "bearer-or-header",  REST_HOOKS, "Default basePath /hooks; X-OpenClaw-Token also accepted"),
  hooksAgent:                 rest("hooks",             "POST", "<basePath>/agent",                         "bearer-or-header",  REST_HOOKS),
  hooksMapping:               rest("hooks",             "POST", "<basePath>/<mapping>",                     "bearer-or-header",  REST_HOOKS, "User-defined mappings (Gmail, custom)"),

  openaiModelsList:           rest("openai-compat",     "GET",  "/v1/models",                               "bearer",            REST_OPENAI),
  openaiModelsGet:            rest("openai-compat",     "GET",  "/v1/models/{model}",                       "bearer",            REST_OPENAI),
  openaiEmbeddings:           rest("openai-compat",     "POST", "/v1/embeddings",                           "bearer",            REST_OPENAI),
  openaiChatCompletions:      rest("openai-compat",     "POST", "/v1/chat/completions",                     "bearer",            REST_OPENAI),
  openaiResponses:            rest("openai-compat",     "POST", "/v1/responses",                            "bearer",            REST_OPENAI),

  toolsInvoke:                rest("tools",             "POST", "/tools/invoke",                            "bearer",            REST_TOOLS),

  sessionKill:                rest("session-control",   "POST", "/sessions/:sessionKey/kill",               "bearer",            REST_SESSIONS),
  sessionHistory:             rest("session-control",   "GET",  "/sessions/:sessionKey/history",            "bearer",            REST_SESSIONS),

  managedMediaOutgoing:       rest("managed-media",     "GET",  "/api/chat/media/outgoing/...",             "bearer",            REST_MANAGED_MEDIA),

  controlUiSpa:               rest("control-ui",        "GET",  "<basePath>/...",                           "none",              REST_CONTROL_UI, "Active only when gateway.controlUi.enabled"),
  controlUiAvatar:            rest("control-ui",        "GET",  "<basePath>/avatar/...",                    "none",              REST_CONTROL_UI),
  controlUiAssistantMedia:    rest("control-ui",        "GET",  "/__openclaw__/assistant-media/...",        "none",              REST_CONTROL_UI),
  controlUiConfig:            rest("control-ui",        "GET",  "/__openclaw/control-ui-config.json",       "none",              REST_CONTROL_UI),

  mcpEntry:                   rest("mcp",               "POST", "/mcp",                                     "bearer-loopback",   REST_MCP, "Loopback HTTP server, not the Gateway HTTP server"),
  mcpWellKnown:               rest("mcp",               "GET",  "/.well-known/*",                           "none",              REST_MCP, "Reserved; returns 404"),
} as const satisfies Record<string, ProviderRestEndpoint>;

// --- Events ------------------------------------------------------------------
//
// GATEWAY_EVENTS lives in `src/gateway/server-methods-list.ts` of the openclaw
// repo; the upstream doc points to it as the canonical event registry but does
// not enumerate names. Populate this map as the event registry is mirrored.

const EVENTS: Record<string, ProviderEventSpec> = {};

// --- Manifest export ---------------------------------------------------------

export const OPENCLAW_MANIFEST: ProviderManifest = {
  provider: "openclaw",
  version: "1",
  upstream: {
    repo: "../harness/openclaw",
    path: "docs/api/providers/openclaw/api-endpoints.md",
    note: "Vendored mirror at docs/api/providers/openclaw/api-endpoints.md in this repo.",
  },
  rpc: RPC,
  rest: REST,
  events: EVENTS,
};
