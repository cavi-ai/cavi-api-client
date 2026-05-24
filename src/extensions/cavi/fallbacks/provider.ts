import type {
  GatewaySnapshotFallbackProvider,
} from "../../../core/gateway/snapshots/loaders.js";
import type {
  OperatorControlSnapshot,
  ProjectBoardWorkspaceSnapshot,
  TaskDiscourseSnapshot,
} from "../domain/index.js";
import {
  fallbackAgentRuns,
  fallbackCostHistory,
  fallbackIncidents,
  fallbackOverview,
  fallbackOperatorControl,
  fallbackProjectBoardWorkspace,
  fallbackRoutingMatrix,
  fallbackRunDetailForKey,
  fallbackTaskDiscourse,
} from "./snapshots/index.js";

export type CaviControlAdapterFallbacks = {
  projectBoardWorkspace?:
    | ProjectBoardWorkspaceSnapshot
    | (() => ProjectBoardWorkspaceSnapshot);
  operatorControl?: OperatorControlSnapshot | (() => OperatorControlSnapshot);
  taskDiscourse?:
    | TaskDiscourseSnapshot
    | ((taskId: string) => TaskDiscourseSnapshot);
};

export type CaviControlAdapterFallbackProvider = GatewaySnapshotFallbackProvider & {
  cavi?: CaviControlAdapterFallbacks;
};

export function createCaviSnapshotFallbackProvider(): GatewaySnapshotFallbackProvider {
  return {
    snapshots: {
      overview: fallbackOverview,
      agentRuns: fallbackAgentRuns,
      runDetail: fallbackRunDetailForKey,
      routingMatrix: fallbackRoutingMatrix,
      incidents: fallbackIncidents,
    },
    costHistory: fallbackCostHistory,
  };
}

export function createCaviControlAdapterFallbackProvider(): CaviControlAdapterFallbackProvider {
  return {
    ...createCaviSnapshotFallbackProvider(),
    cavi: {
      projectBoardWorkspace: fallbackProjectBoardWorkspace,
      operatorControl: fallbackOperatorControl,
      taskDiscourse: fallbackTaskDiscourse,
    },
  };
}
