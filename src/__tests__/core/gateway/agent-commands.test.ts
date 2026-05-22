import { describe, expect, it } from "vitest";
import {
  buildAgentSlashShortcuts,
  extractGatewayCommandCatalog,
} from "../../../core/gateway/agent-commands";
import type { GatewayCapabilities } from "../../../core/gateway/client";

describe("gateway agent commands", () => {
  it("extracts slash commands from /v1/capabilities commands", () => {
    const capabilities = {
      object: "gateway.capabilities",
      features: {},
      commands: [
        "/help",
        {
          command: "/joke",
          description: "Generate a joke",
          category: "creative",
        },
        {
          name: "status",
          summary: "Show gateway status",
        },
      ],
    } satisfies GatewayCapabilities;

    expect(extractGatewayCommandCatalog(capabilities)).toEqual([
      {
        id: "core_help",
        label: "/help",
        insert: "/help",
      },
      {
        id: "core_joke",
        label: "/joke",
        insert: "/joke",
        description: "Generate a joke",
      },
      {
        id: "core_status",
        label: "/status",
        insert: "/status",
        description: "Show gateway status",
      },
    ]);
  });

  it("accepts nested slash command catalogs and uses them instead of fallback built-ins", () => {
    const coreCommands = extractGatewayCommandCatalog({
      features: {},
      slash_commands: {
        core: [{ template: "/model ", help: "Set the active model" }],
        agent: {
          commands: [{ insert: "/focus scout", description: "Focus scout" }],
        },
      },
    });

    expect(coreCommands.map((command) => command.insert)).toEqual([
      "/model ",
      "/focus scout",
    ]);
    expect(
      buildAgentSlashShortcuts(null, { coreCommands }).map(
        (command) => command.insert,
      ),
    ).toEqual(["/model ", "/focus scout"]);
  });

  it("accepts command catalogs nested under capabilities features", () => {
    expect(
      extractGatewayCommandCatalog({
        features: {
          commands: [{ command: "/tools", description: "List tools" }],
        },
      }),
    ).toEqual([
      {
        id: "core_tools",
        label: "/tools",
        insert: "/tools",
        description: "List tools",
      },
    ]);
  });
});
