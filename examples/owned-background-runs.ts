import { ApiClientError, ApiClientErrorCode, ApiClientErrorType, waitForRun, type CapabilityClient, type CapabilityResult, type RunWaitOptions, type RunWaitResult } from "@cavi-ai/api-client";

// Application policy backed by stored ownership and permissions in this client's scope.
export type CanAccessRun = (
  actorId: string,
  runId: string,
  action: "read" | "cancel",
) => Promise<boolean>;

export function createOwnedRunService(client: CapabilityClient, canAccess: CanAccessRun) {
  async function assertAccess(actorId: string, runId: string, action: "read" | "cancel") {
    if (await canAccess(actorId, runId, action) !== true) {
      throw new ApiClientError("Run access denied.", {
        type: ApiClientErrorType.Auth, code: ApiClientErrorCode.PermissionDenied,
      });
    }
  }

  async function get(actorId: string, runId: string) {
    await assertAccess(actorId, runId, "read");
    return client.getRun(runId);
  }

  return {
    get,
    async wait(
      actorId: string,
      runId: string,
      options: RunWaitOptions,
    ): Promise<CapabilityResult<RunWaitResult>> {
      const initial = await get(actorId, runId);
      if (!initial.ok) return initial;
      const data = await waitForRun({ getRun: (id) => get(actorId, id) }, initial.data, options);
      return { ok: true, source: initial.source, data };
    },
    async cancel(actorId: string, runId: string) {
      await assertAccess(actorId, runId, "cancel");
      return client.cancelRun(runId);
    },
  };
}
