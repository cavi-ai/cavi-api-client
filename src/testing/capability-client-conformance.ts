import type { CapabilityClient } from "../contracts/capability-client.js";

export type CapabilityClientProbe = {
  call: string;
  resolved: boolean;
  ok?: boolean;
  error?: unknown;
};

export type CapabilityClientConformanceReport = {
  ok: boolean;
  probes: CapabilityClientProbe[];
  rejections: CapabilityClientProbe[];
};

/**
 * The non-throwing contract, made checkable: call one representative method
 * per facade surface and verify each RESOLVES (ok:true or ok:false) instead
 * of rejecting. Probes run against an undeclared/unwired client — nothing
 * should escalate to the auth/unknown carve-outs.
 *
 * `events.subscribe` is probed like every other gated surface: it resolves a
 * `CapabilityResult` (`ok:false` on a bare/undeclared client). On the rare
 * client where it resolves `ok:true` (a live subscription), the probe disposes
 * the returned `RuntimeEventSubscription` so the inspector never leaks a live
 * subscription against a real backend.
 */
export async function inspectCapabilityClientConformance(
  client: CapabilityClient,
): Promise<CapabilityClientConformanceReport> {
  const probes: Array<{ call: string; run: () => Promise<{ ok: boolean }> }> = [
    { call: "startRun", run: () => client.startRun({ input: "conformance probe", dryRun: true }) },
    { call: "getRun", run: () => client.getRun("conformance-probe") },
    { call: "cancelRun", run: () => client.cancelRun("conformance-probe") },
    {
      call: "streamRun",
      run: () => client.streamRun({ input: "conformance probe", dryRun: true }, { onEvent: () => undefined }),
    },
    { call: "submitBatch", run: () => client.submitBatch([]) },
    { call: "getBatch", run: () => client.getBatch("conformance-probe") },
    { call: "cancelBatch", run: () => client.cancelBatch("conformance-probe") },
    { call: "getBatchResults", run: () => client.getBatchResults("conformance-probe") },
    { call: "sessions.listSessions", run: () => client.sessions.listSessions({}) },
    { call: "tasks.listTasks", run: () => client.tasks.listTasks({}) },
    { call: "models.listModels", run: () => client.models.listModels() },
    { call: "usage.getUsage", run: () => client.usage.getUsage({}) },
    { call: "authStatus.listAuthStatus", run: () => client.authStatus.listAuthStatus() },
    {
      call: "events.subscribe",
      run: async () => {
        const result = await client.events.subscribe(
          { operationId: "conformance-probe" },
          { onEvent: () => undefined },
        );
        if (result.ok) await result.data.dispose?.();
        return result;
      },
    },
    // WorkspaceClient.listWorkspaces() takes no arguments.
    { call: "workspace.listWorkspaces", run: () => client.workspace.listWorkspaces() },
    { call: "kanban.listBoards", run: () => client.kanban.listBoards() },
    { call: "teams.listTeams", run: () => client.teams.listTeams() },
    { call: "media.listMediaProviders", run: () => client.media.listMediaProviders() },
    { call: "wiki.listWikiVaults", run: () => client.wiki.listWikiVaults() },
    { call: "agentConfig.listProfiles", run: () => client.agentConfig.listProfiles() },
  ];

  const results: CapabilityClientProbe[] = [];
  for (const probe of probes) {
    try {
      const result = await probe.run();
      results.push({ call: probe.call, resolved: true, ok: result.ok });
    } catch (error) {
      results.push({ call: probe.call, resolved: false, error });
    }
  }
  const rejections = results.filter((probe) => !probe.resolved);
  return { ok: rejections.length === 0, probes: results, rejections };
}
