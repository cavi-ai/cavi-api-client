export type RuntimeStatus<TMetadata extends object = object> = {
  state: "idle" | "running";
  metadata?: TMetadata;
};
