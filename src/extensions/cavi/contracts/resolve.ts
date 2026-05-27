import { createSurfacePathResolver } from "../../../contracts/resolve.js";
import { CAVI_SURFACE_CONTRACTS } from "./surfaces.js";

export const resolveCaviPath = createSurfacePathResolver(CAVI_SURFACE_CONTRACTS);

export const resolvePath = resolveCaviPath;
