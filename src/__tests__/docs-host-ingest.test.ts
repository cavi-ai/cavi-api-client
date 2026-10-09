import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { DOCUMENTED_OUTPUT_DIRECTORY, DOCUMENTED_VERSION } from "../../scripts/docs/types.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

describe("docs host ingest contract", () => {
  it.each(["root", "wrapped", "ambiguous"])("handles a %s archive layout", (layout) => {
    const scratch = mkdtempSync(path.join(tmpdir(), "cavi-docs-host-layout-"));
    try {
      const contents = path.join(scratch, "contents");
      mkdirSync(contents);
      const source = path.join(ROOT, DOCUMENTED_OUTPUT_DIRECTORY);
      cpSync(source, layout === "root" ? contents : path.join(contents, "documentation"), { recursive: true });
      if (layout === "ambiguous") cpSync(source, path.join(contents, "second"), { recursive: true });
      const archive = path.join(scratch, "docs.tar.gz");
      execFileSync("tar", ["-czf", archive, "-C", contents, "."]);
      const extraction = path.join(scratch, "extraction");
      mkdirSync(extraction);
      const run = () => execFileSync(process.execPath, [path.join(ROOT, "scripts/docs/check-host-ingest.mjs"),
        "--archive", archive, "--expect-version", DOCUMENTED_VERSION,
      ], { encoding: "utf8", stdio: "pipe", env: { ...process.env, TMPDIR: extraction } });
      if (layout === "ambiguous") {
        expect(run).toThrow("archive must contain exactly one documentation root; found 2");
      } else {
        expect(run()).toContain(`docs:host-ingest-check — ok @cavi-ai/api-client@${DOCUMENTED_VERSION}`);
      }
      expect(readdirSync(extraction)).toEqual([]);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it("validates the committed versioned docs tree", () => {
    const output = execFileSync(
      process.execPath,
      [
        path.join(ROOT, "scripts/docs/check-host-ingest.mjs"),
        "--dir",
        path.join(ROOT, DOCUMENTED_OUTPUT_DIRECTORY),
        "--expect-version",
        DOCUMENTED_VERSION,
      ],
      { encoding: "utf8" },
    );
    expect(output).toContain("docs:host-ingest-check — ok");
    expect(output).toContain(`@cavi-ai/api-client@${DOCUMENTED_VERSION}`);
  });

  it("keeps navigation sections non-empty and distinctly titled", () => {
    const navigation = JSON.parse(
      readFileSync(path.join(ROOT, DOCUMENTED_OUTPUT_DIRECTORY, "navigation.json"), "utf8"),
    ) as {
      sections: Array<{ title: string; pages?: unknown[] }>;
    };
    const titles = navigation.sections.map((section) => section.title);
    expect(titles).toContain("Operations");
    expect(titles).toContain("Type reference");
    expect(titles.filter((title) => /^API reference$/iu.test(title))).toEqual([]);
    for (const section of navigation.sections) {
      expect(section.pages?.length ?? 0, section.title).toBeGreaterThan(0);
    }
  });
});
