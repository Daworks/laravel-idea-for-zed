import { Definition, Location } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { RouteRepository } from "../../repositories/routes";
import * as path from "path";
import * as fs from "fs";

/**
 * Provides go-to-definition for route names.
 * Uses line info from PHP Reflection (collected during route loading)
 * and falls back to text search when needed.
 */
export class RouteDefinitionProvider {
  constructor(
    private repository: RouteRepository,
    private projectPath: string
  ) {}

  /**
   * Resolve the definition location for a route name.
   * @param routeName - The full route name (e.g., "users.index")
   */
  provideDefinition(routeName: string): Definition | null {
    const route = this.repository.findByName(routeName);
    if (!route || !route.controllerFilePath) return null;

    // Resolve relative paths to absolute
    const filePath = path.isAbsolute(route.controllerFilePath)
      ? route.controllerFilePath
      : path.join(this.projectPath, route.controllerFilePath);

    if (!fs.existsSync(filePath)) return null;

    // If we have a line number from Reflection, use it directly
    if (route.controllerFileLine) {
      const line = route.controllerFileLine - 1; // PHP lines are 1-based, LSP is 0-based
      return Location.create(URI.file(filePath).toString(), {
        start: { line, character: 0 },
        end: { line, character: 0 },
      });
    }

    // Fallback: search for the method name in the file
    if (route.controllerMethod) {
      return this.findMethodInFile(filePath, route.controllerMethod);
    }

    // Last resort: go to file start
    return Location.create(URI.file(filePath).toString(), {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    });
  }

  /** Search for a method definition in a PHP file */
  private findMethodInFile(
    filePath: string,
    methodName: string
  ): Definition | null {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      const methodPattern = new RegExp(
        `\\bfunction\\s+${escapeRegex(methodName)}\\s*\\(`
      );

      for (let i = 0; i < lines.length; i++) {
        if (methodPattern.test(lines[i])) {
          const charIndex = lines[i].indexOf(methodName);
          return Location.create(URI.file(filePath).toString(), {
            start: { line: i, character: Math.max(0, charIndex) },
            end: { line: i, character: Math.max(0, charIndex) + methodName.length },
          });
        }
      }

      return Location.create(URI.file(filePath).toString(), {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      });
    } catch {
      return null;
    }
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
