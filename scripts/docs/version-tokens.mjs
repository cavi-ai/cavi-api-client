export const DOCUMENTED_VERSION_TOKEN = "{{documentedVersion}}";

const SEMANTIC_VERSION_LITERAL =
  /\b(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?\b/gu;

/**
 * Resolve the selected release version in editable documentation sources.
 * Numeric semantic versions are forbidden there so release bumps cannot leave
 * stale prose or evidence paths behind.
 *
 * @param {string} source
 * @param {string} version
 * @param {string} [label]
 */
export function resolveDocumentedVersionToken(
  source,
  version,
  label = "documentation source",
) {
  const hardCodedVersion = source
    .replaceAll(DOCUMENTED_VERSION_TOKEN, "")
    .match(SEMANTIC_VERSION_LITERAL)?.[0];
  if (hardCodedVersion) {
    throw new Error(
      `${label} contains hard-coded semantic version ${hardCodedVersion}; use ${DOCUMENTED_VERSION_TOKEN}`,
    );
  }

  const resolved = source.replaceAll(DOCUMENTED_VERSION_TOKEN, version);
  // Curated examples intentionally retain host/runtime placeholders such as
  // {{gatewayUrl}}. Only this build system's documented-version namespace is
  // reserved and typo-checked here.
  const unknownToken = resolved.match(/\{\{documented[^{}\n]*\}\}/u)?.[0];
  if (unknownToken) {
    throw new Error(`${label} contains unknown token ${unknownToken}`);
  }
  return resolved;
}
