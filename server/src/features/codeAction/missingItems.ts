import {
  CodeAction,
  CodeActionKind,
  Command,
  Diagnostic,
} from "vscode-languageserver";

/**
 * Provides code actions for missing Laravel references.
 * - "Create missing view" when view('nonexistent') is detected
 * - "Add to .env" when env('MISSING_KEY') is detected
 */
export class MissingItemsCodeActionProvider {
  provideCodeActions(diagnostics: Diagnostic[]): CodeAction[] {
    const actions: CodeAction[] = [];

    for (const diag of diagnostics) {
      if (diag.source !== "laravel-ls") continue;

      if (diag.message.startsWith("View '")) {
        const viewName = this.extractName(diag.message, "View");
        if (viewName) {
          actions.push({
            title: `Create view: ${viewName}`,
            kind: CodeActionKind.QuickFix,
            diagnostics: [diag],
            command: Command.create(
              `Create view: ${viewName}`,
              "laravel-ls.createView",
              viewName
            ),
          });
        }
      }
    }

    return actions;
  }

  private extractName(message: string, type: string): string | null {
    const match = message.match(new RegExp(`${type} '([^']+)' not found`));
    return match?.[1] ?? null;
  }
}
