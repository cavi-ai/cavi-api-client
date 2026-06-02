// Provider-agnostic manifest schema. A provider manifest declares — in one
// place — the gateway methods, REST endpoints, and events that gateway exposes
// to clients. The api-client derives everything else (method tables, capability
// shapes, typed namespaces, Postman collections) from this single source so we
// never duplicate names. Mirrors the upstream gateway docs; never invents API.

export type GatewayScope =
  | "operator.read"
  | "operator.write"
  | "operator.admin"
  | "operator.approvals"
  | "operator.pairing"
  | "operator.talk.secrets"
  | "node"
  | "dynamic";

export type ProviderRpcStatus =
  | "doc-only"        // listed in the upstream gateway doc; param/response shapes not yet captured
  | "shape-verified"  // params/response shapes verified against the gateway source or schema
  | "live-verified";  // additionally exercised against a live gateway (e.g. via Postman)

export type ProviderRestStatus = "doc-only" | "live-verified";

export type ParamSpec = {
  type: string;
  required?: boolean;
  note?: string;
};

export type ResponseSpec = {
  shape?: string;
  note?: string;
};

export type RpcBehaviorSpec = {
  blocking?: boolean;
  streamsEvents?: boolean;
  idempotent?: boolean;
  aborts?: string;
};

export type ProviderRpcMethod = {
  /** Wire method name, e.g. `chat.send`. */
  method: string;
  /** Slug grouping the method, mirrors the upstream doc's section. */
  category: string;
  /** Required scope(s) to invoke. `dynamic` is plugin-resolved per call. */
  scope: GatewayScope | readonly GatewayScope[];
  /** Whether the gateway advertises this method in `hello-ok.features.methods`. */
  advertised: boolean;
  status: ProviderRpcStatus;
  params?: Record<string, ParamSpec>;
  response?: ResponseSpec;
  behavior?: RpcBehaviorSpec;
  /** Stable anchor or section label from the upstream doc (drift detection). */
  docSection?: string;
  note?: string;
};

export type ProviderRestEndpoint = {
  /** Surface grouping mirrors the upstream doc's HTTP families. */
  surface: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";
  /** Path template, e.g. `/sessions/:sessionKey/kill`. */
  path: string;
  auth: "none" | "bearer" | "bearer-or-header" | "bearer-loopback" | "plugin-defined";
  status: ProviderRestStatus;
  docSection?: string;
  note?: string;
};

export type ProviderEventSpec = {
  name: string;
  family: string;
  payload?: ResponseSpec;
  note?: string;
};

export type ProviderManifest = {
  /** Provider identifier (`openclaw`, `hermes`, …). */
  provider: string;
  /** Manifest revision; bump when the schema or content shape changes. */
  version: string;
  /** Upstream doc location this manifest mirrors. */
  upstream: {
    repo: string;
    path: string;
    note?: string;
  };
  rpc: Readonly<Record<string, ProviderRpcMethod>>;
  rest: Readonly<Record<string, ProviderRestEndpoint>>;
  events: Readonly<Record<string, ProviderEventSpec>>;
};

export type DerivedRpcMethodTable<TManifest extends ProviderManifest> = {
  readonly [K in keyof TManifest["rpc"]]: TManifest["rpc"][K]["method"];
};
