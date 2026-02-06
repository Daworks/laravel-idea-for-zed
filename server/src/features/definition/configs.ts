import { Definition, Location } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { ConfigRepository } from "../../repositories/configs";
import * as path from "path";
import * as fs from "fs";

/**
 * Provides go-to-definition for config keys.
 * Navigates to the config file and tries to find the key definition.
 */
export class ConfigDefinitionProvider {
  constructor(
    private repository: ConfigRepository,
    private projectPath: string
  ) {}

  provideDefinition(configKey: string): Definition | null {
    const config = this.repository.findByKey(configKey);
    if (!config) return null;

    const filePath = path.join(this.projectPath, config.file);
    if (!fs.existsSync(filePath)) return null;

    // Try to find the exact key in the config file
    const line = this.findKeyInFile(filePath, configKey);

    return Location.create(URI.file(filePath).toString(), {
      start: { line, character: 0 },
      end: { line, character: 0 },
    });
  }

  /** Find the line number of a config key in a PHP file */
  private findKeyInFile(filePath: string, configKey: string): number {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      // Extract the leaf key: "app.name" → "name"
      const parts = configKey.split(".");
      const leafKey = parts[parts.length - 1];

      // Search for 'key' => or "key" =>
      const pattern = new RegExp(`['"](${escapeRegex(leafKey)})['"]\\s*=>`);

      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          return i;
        }
      }
    } catch {
      // Fall through to return 0
    }

    return 0;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
