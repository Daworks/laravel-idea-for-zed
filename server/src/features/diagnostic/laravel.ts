import {
  Connection,
  Diagnostic,
  DiagnosticSeverity,
  Range,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { RouteRepository } from "../../repositories/routes";
import { ViewRepository } from "../../repositories/views";
import { ConfigRepository } from "../../repositories/configs";

/**
 * Provides diagnostics for Laravel files:
 * - Missing route names
 * - Missing view names
 * - Missing config keys
 */
export class LaravelDiagnosticProvider {
  constructor(
    private routeRepo: RouteRepository | undefined,
    private viewRepo: ViewRepository | undefined,
    private configRepo: ConfigRepository | undefined
  ) {}

  provideDiagnostics(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check route('name') references
      this.checkReferences(
        line,
        i,
        /(?:route|to_route)\s*\(\s*['"]([^'"]+)['"]/g,
        (name) => this.routeRepo?.findByName(name) !== undefined,
        "Route",
        diagnostics
      );

      // Check view('name') references
      this.checkReferences(
        line,
        i,
        /(?:view|View::make)\s*\(\s*['"]([^'"]+)['"]/g,
        (name) => this.viewRepo?.findByName(name) !== undefined,
        "View",
        diagnostics
      );

      // Check config('key') references (only exact keys)
      this.checkReferences(
        line,
        i,
        /(?:config)\s*\(\s*['"]([^'"]+)['"]/g,
        (key) => this.configRepo?.findByKey(key) !== undefined,
        "Config",
        diagnostics
      );
    }

    return diagnostics;
  }

  private checkReferences(
    line: string,
    lineNumber: number,
    pattern: RegExp,
    exists: (name: string) => boolean,
    type: string,
    diagnostics: Diagnostic[]
  ): void {
    const matches = Array.from(line.matchAll(pattern));
    for (const match of matches) {
      const name = match[1];
      if (!name) continue;

      if (!exists(name)) {
        const startChar = match.index! + match[0].indexOf(name);
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          range: Range.create(
            lineNumber,
            startChar,
            lineNumber,
            startChar + name.length
          ),
          message: `${type} '${name}' not found`,
          source: "laravel-ls",
        });
      }
    }
  }
}
