import { Connection } from "vscode-languageserver";
import * as fs from "fs";
import * as path from "path";
import { BoundedCache } from "../support/cache";

export interface EnvVariable {
  key: string;
  value: string;
  line: number;
  comment?: string;
}

/**
 * Repository for collecting .env file variables.
 * Parses .env and .env.example files directly (no PHP execution needed).
 */
export class EnvRepository {
  private variables: EnvVariable[] = [];
  private variablesByKey: Map<string, EnvVariable> = new Map();
  private cache: BoundedCache<EnvVariable[]>;

  constructor(
    private projectPath: string,
    private connection: Connection
  ) {
    this.cache = new BoundedCache<EnvVariable[]>(10, 5 * 60 * 1000);
  }

  async load(): Promise<void> {
    const cached = this.cache.get("env");
    if (cached) {
      this.setVariables(cached);
      return;
    }

    try {
      // Parse .env file, fall back to .env.example
      const envFiles = [
        path.join(this.projectPath, ".env"),
        path.join(this.projectPath, ".env.example"),
      ];

      let variables: EnvVariable[] = [];

      for (const envFile of envFiles) {
        if (fs.existsSync(envFile)) {
          variables = this.parseEnvFile(envFile);
          break;
        }
      }

      // Also merge keys from .env.example that aren't in .env
      const examplePath = path.join(this.projectPath, ".env.example");
      if (
        variables.length > 0 &&
        fs.existsSync(examplePath) &&
        envFiles[0] !== examplePath
      ) {
        const exampleVars = this.parseEnvFile(examplePath);
        const existingKeys = new Set(variables.map((v) => v.key));
        for (const v of exampleVars) {
          if (!existingKeys.has(v.key)) {
            variables.push(v);
          }
        }
      }

      this.setVariables(variables);
      this.cache.set("env", variables);
      this.connection.console.log(
        `[Env] Loaded ${variables.length} environment variables`
      );
    } catch (e) {
      this.connection.console.log(`[Env] Failed to load: ${e}`);
    }
  }

  async reload(): Promise<void> {
    this.cache.clear();
    await this.load();
  }

  findByKey(key: string): EnvVariable | undefined {
    return this.variablesByKey.get(key);
  }

  search(query: string): EnvVariable[] {
    if (!query) return this.variables;
    const upper = query.toUpperCase();
    return this.variables.filter((v) => v.key.toUpperCase().includes(upper));
  }

  getAll(): EnvVariable[] {
    return this.variables;
  }

  count(): number {
    return this.variables.length;
  }

  private setVariables(variables: EnvVariable[]): void {
    this.variables = variables;
    this.variablesByKey.clear();
    for (const v of variables) {
      this.variablesByKey.set(v.key, v);
    }
  }

  /**
   * Parse a .env file into key-value pairs.
   * Handles comments, quoted values, and multi-line values.
   */
  private parseEnvFile(filePath: string): EnvVariable[] {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const variables: EnvVariable[] = [];
    let lastComment: string | undefined;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Track comments (for documentation)
      if (line.startsWith("#")) {
        lastComment = line.substring(1).trim();
        continue;
      }

      // Skip empty lines
      if (!line) {
        lastComment = undefined;
        continue;
      }

      // Parse KEY=VALUE
      const eqIndex = line.indexOf("=");
      if (eqIndex === -1) continue;

      const key = line.substring(0, eqIndex).trim();
      let value = line.substring(eqIndex + 1).trim();

      // Track whether value was quoted (quoted values preserve # as literal)
      const isQuoted =
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"));

      if (isQuoted) {
        value = value.substring(1, value.length - 1);
      } else {
        // Remove inline comments only for unquoted values
        const commentIdx = value.indexOf(" #");
        if (commentIdx !== -1) {
          value = value.substring(0, commentIdx).trim();
        }
      }

      variables.push({
        key,
        value,
        line: i + 1,
        comment: lastComment,
      });

      lastComment = undefined;
    }

    return variables;
  }
}
