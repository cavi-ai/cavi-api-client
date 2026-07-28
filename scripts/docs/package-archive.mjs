import { gunzipSync } from "node:zlib";

import { normalizedRelativePath } from "./paths.mjs";

const BLOCK_SIZE = 512;
const DEFAULT_MAX_FILE_COUNT = 20_000;
const DEFAULT_MAX_EXPANDED_BYTES = 128 * 1024 * 1024;

function positiveLimit(value, fallback, label) {
  const limit = value ?? fallback;
  if (!Number.isSafeInteger(limit) || limit <= 0) throw new Error(`invalid ${label}`);
  return limit;
}

function zeroBlock(block) {
  return block.length === BLOCK_SIZE && block.every((byte) => byte === 0);
}

function tarString(field, label) {
  const nul = field.indexOf(0);
  const bytes = nul === -1 ? field : field.subarray(0, nul);
  if (nul !== -1 && field.subarray(nul).some((byte) => byte !== 0)) {
    throw new Error(`invalid tar ${label}`);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`invalid tar ${label}`);
  }
}

function tarOctal(field, label) {
  const encoded = field.toString("ascii").replace(/\0/gu, " ").trim();
  if (!/^[0-7]+$/u.test(encoded)) throw new Error(`invalid tar ${label}`);
  const value = Number.parseInt(encoded, 8);
  if (!Number.isSafeInteger(value)) throw new Error(`invalid tar ${label}`);
  return value;
}

function verifyChecksum(header) {
  const expected = tarOctal(header.subarray(148, 156), "checksum");
  let observed = 0;
  for (let index = 0; index < header.length; index += 1) {
    observed += index >= 148 && index < 156 ? 0x20 : header[index];
  }
  if (observed !== expected) throw new Error("invalid tar header checksum");
}

function entryPath(header) {
  const name = tarString(header.subarray(0, 100), "entry name");
  const prefix = tarString(header.subarray(345, 500), "entry prefix");
  return prefix ? `${prefix}/${name}` : name;
}

export function preflightPackageArchive(archive, limits = {}) {
  const maxFileCount = positiveLimit(
    limits.maxFileCount,
    DEFAULT_MAX_FILE_COUNT,
    "archive file count limit",
  );
  const maxExpandedBytes = positiveLimit(
    limits.maxExpandedBytes,
    DEFAULT_MAX_EXPANDED_BYTES,
    "archive expanded size limit",
  );
  const maximumTarBytes = maxExpandedBytes + (maxFileCount + 2) * BLOCK_SIZE * 2;
  if (!Number.isSafeInteger(maximumTarBytes)) throw new Error("invalid archive limits");

  let tar;
  try {
    tar = gunzipSync(archive, { maxOutputLength: maximumTarBytes });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ERR_BUFFER_TOO_LARGE"
    ) {
      throw new Error("archive expanded size limit exceeded");
    }
    throw new Error(`invalid gzip archive: ${error instanceof Error ? error.message : String(error)}`);
  }

  const entries = new Map();
  let offset = 0;
  let expandedBytes = 0;
  let sawTerminator = false;
  while (offset < tar.length) {
    if (tar.length - offset < BLOCK_SIZE) throw new Error("truncated tar header");
    const header = tar.subarray(offset, offset + BLOCK_SIZE);
    if (zeroBlock(header)) {
      const next = tar.subarray(offset + BLOCK_SIZE, offset + BLOCK_SIZE * 2);
      if (!zeroBlock(next) || tar.subarray(offset).some((byte) => byte !== 0)) {
        throw new Error("invalid tar terminator");
      }
      sawTerminator = true;
      break;
    }

    verifyChecksum(header);
    const rawPath = entryPath(header);
    const type = header[156];
    const isFile = type === 0 || type === 0x30;
    const isDirectory = type === 0x35;
    if (!isFile && !isDirectory) {
      throw new Error(`archive entry must be a regular file or directory: ${rawPath}`);
    }
    const candidate = isDirectory && rawPath.endsWith("/") ? rawPath.slice(0, -1) : rawPath;
    let normalized;
    try {
      normalized = normalizedRelativePath(candidate, "archive entry");
    } catch (error) {
      throw new Error(`archive entry must be normalized: ${rawPath}`, { cause: error });
    }
    if (
      normalized === "package"
        ? !isDirectory
        : !normalized.startsWith("package/")
    ) {
      throw new Error(`archive entry escapes package root: ${rawPath}`);
    }
    if (entries.has(normalized)) throw new Error(`duplicate archive entry: ${normalized}`);
    if (entries.size + 1 > maxFileCount) throw new Error("archive file count limit exceeded");

    const size = tarOctal(header.subarray(124, 136), "entry size");
    if (isDirectory && size !== 0) throw new Error(`archive directory has non-zero size: ${rawPath}`);
    if (isFile) {
      expandedBytes += size;
      if (!Number.isSafeInteger(expandedBytes) || expandedBytes > maxExpandedBytes) {
        throw new Error("archive expanded size limit exceeded");
      }
    }
    const dataEnd = offset + BLOCK_SIZE + size;
    const nextOffset = dataEnd + ((BLOCK_SIZE - (size % BLOCK_SIZE)) % BLOCK_SIZE);
    if (dataEnd > tar.length || nextOffset > tar.length) {
      throw new Error(`truncated tar entry: ${rawPath}`);
    }
    entries.set(normalized, isDirectory ? "directory" : "file");
    offset = nextOffset;
  }

  if (!sawTerminator) throw new Error("tar archive is missing its terminator");
  for (const [name] of entries) {
    const segments = name.split("/");
    for (let index = 1; index < segments.length; index += 1) {
      if (entries.get(segments.slice(0, index).join("/")) === "file") {
        throw new Error(`archive entry descends through a regular file: ${name}`);
      }
    }
  }

  return Object.freeze(
    [...entries].map(([name, type]) => Object.freeze({ name, type })),
  );
}
