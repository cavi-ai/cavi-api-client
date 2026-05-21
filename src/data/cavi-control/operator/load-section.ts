import type {
  ContractGap,
  OperatorControlSnapshot,
  OperatorControlSectionKey,
} from "../../../domain/index.js";
import { CaviControlApiError } from "../api-error.js";
import { classifyFallbackError, fallbackGap } from "../envelope.js";

export type OperatorSectionLoadResult<
  TKey extends OperatorControlSectionKey,
  TData,
> = {
  key: TKey;
  data: TData;
  status: OperatorControlSnapshot["sectionStatus"][TKey];
  contractGap: ContractGap | null;
};

export function createOperatorSectionStatus<
  TKey extends OperatorControlSectionKey,
>(params: {
  available: boolean;
  authoritative: boolean;
  error: string | null;
  sampleLimit: number | null;
}): OperatorControlSnapshot["sectionStatus"][TKey] {
  return {
    available: params.available,
    authoritative: params.authoritative,
    error: params.error,
    sampleLimit: params.sampleLimit,
  };
}

export async function loadOperatorControlSection<
  TKey extends OperatorControlSectionKey,
  TData,
>(params: {
  key: TKey;
  run: () => Promise<TData>;
  fallback: () => TData;
  authoritative: boolean;
  sampleLimit: number | null;
  expectedContract: string;
  note: string;
}): Promise<OperatorSectionLoadResult<TKey, TData>> {
  try {
    const data = await params.run();
    return {
      key: params.key,
      data,
      status: createOperatorSectionStatus({
        available: true,
        authoritative: params.authoritative,
        error: null,
        sampleLimit: params.sampleLimit,
      }),
      contractGap: null,
    };
  } catch (error) {
    if (
      error instanceof CaviControlApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      throw error;
    }

    return {
      key: params.key,
      data: params.fallback(),
      status: createOperatorSectionStatus({
        available: false,
        authoritative: params.authoritative,
        error: error instanceof Error ? error.message : String(error),
        sampleLimit: params.sampleLimit,
      }),
      contractGap: (() => {
        const classified = classifyFallbackError(error);
        return fallbackGap(
          `operator-control.${params.key}`,
          params.expectedContract,
          `${params.note}. ${classified.message}`,
          classified.reason,
          classified.httpStatus,
        );
      })(),
    };
  }
}
