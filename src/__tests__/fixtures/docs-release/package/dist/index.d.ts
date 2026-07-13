export interface RuntimeClient {
  run(input: string): Promise<string>;
}
