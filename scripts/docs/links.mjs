import { readFile, stat } from "node:fs/promises";
import path from "node:path";

function prose(markdown) {
  return markdown.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gmu, "");
}

function anchors(markdown) {
  const result = new Set();
  const counts = new Map();
  const text = prose(markdown);
  for (const match of text.matchAll(/<(?:a|h[1-6])\b[^>]*\bid=["']([^"']+)["']/giu)) result.add(match[1]);
  for (const match of text.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gmu)) {
    const base = match[1].replace(/<[^>]+>/gu, "").toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, "").replace(/\s/gu, "-");
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    result.add(count ? `${base}-${count}` : base);
  }
  return result;
}

/** Validate local file and heading targets, including links within the same page. */
export async function validateMarkdownLinks(root, files, { allowDirectories = false, requireListedTargets = false } = {}) {
  const fileSet = new Set(files);
  const contents = new Map();
  const read = async (file) => {
    if (!contents.has(file)) contents.set(file, await readFile(path.join(root, file), "utf8"));
    return contents.get(file);
  };
  for (const file of files.filter((name) => name.endsWith(".md"))) {
    const source = prose(await read(file));
    const targets = [...source.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)].map((match) => match[1]);
    targets.push(...[...source.matchAll(/^\s*\[[^\]]+\]:\s*(\S+)/gmu)].map((match) => match[1]));
    for (const raw of targets) {
      const target = raw.replace(/^<|>$/gu, "").split(/\s+["']/u)[0];
      if (/^(?:[a-z][a-z0-9+.-]*:|\/)/iu.test(target)) continue;
      const [resource, fragment] = target.split("#", 2);
      const destination = decodeURIComponent(resource.split("?", 1)[0]);
      const resolved = destination ? path.posix.normalize(path.posix.join(path.posix.dirname(file), destination)) : file;
      if (resolved.startsWith("../") || path.posix.isAbsolute(resolved) || (requireListedTargets && !fileSet.has(resolved))) {
        throw new Error(`invalid relative Markdown link: ${file} -> ${target}`);
      }
      const info = await stat(path.join(root, resolved)).catch(() => null);
      if (!info || (info.isDirectory() && !allowDirectories)) {
        throw new Error(`invalid relative Markdown link: ${file} -> ${target}`);
      }
      if (fragment && resolved.endsWith(".md") && !anchors(await read(resolved)).has(decodeURIComponent(fragment))) {
        throw new Error(`invalid Markdown anchor: ${file} -> ${target}`);
      }
    }
  }
}
