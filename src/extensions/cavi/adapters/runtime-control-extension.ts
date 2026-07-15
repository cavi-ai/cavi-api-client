import {
  defineRuntimeControlExtension,
  type RuntimeControlExtensionDescriptor,
} from "../../../core/runtime/control-plane/extensions.js";
import type { CaviControlAdapters } from "./create-cavi-control-adapters.js";

export const CAVI_CONTROL_EXTENSION: RuntimeControlExtensionDescriptor<CaviControlAdapters> =
  defineRuntimeControlExtension<CaviControlAdapters>("cavi.control");
