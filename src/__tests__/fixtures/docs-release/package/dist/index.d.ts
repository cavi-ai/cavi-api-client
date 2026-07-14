export interface RuntimeClient<TInput = string> {
  run(input: TInput): Promise<string>;
}
export declare function createRuntimeClient<TInput>(
  endpoint: URL,
  options?: { timeoutMs?: number },
): RuntimeClient<TInput>;
