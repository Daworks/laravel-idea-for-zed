import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
} from "vscode-languageserver";
import { RouteRepository } from "../../repositories/routes";
import { RouteInfo } from "../../types";

/**
 * Provides route name completions for route(), to_route(), signedRoute(), etc.
 */
export class RouteCompletionProvider {
  constructor(private repository: RouteRepository) {}

  /**
   * Generate completion items for route names.
   * @param prefix - What the user has typed so far inside the string
   */
  provideCompletions(prefix: string): CompletionItem[] {
    const routes = this.repository.search(prefix);

    return routes.map((route, index) => this.toCompletionItem(route, index));
  }

  private toCompletionItem(route: RouteInfo, sortIndex: number): CompletionItem {
    const item: CompletionItem = {
      label: route.name,
      kind: CompletionItemKind.Value,
      detail: `${route.methods.join("|")} ${route.uri}`,
      documentation: {
        kind: MarkupKind.Markdown,
        value: this.buildDocumentation(route),
      },
      sortText: String(sortIndex).padStart(5, "0"),
      filterText: route.name,
      insertText: route.name,
      insertTextFormat: InsertTextFormat.PlainText,
    };

    // If route has parameters, offer a snippet with placeholders
    if (route.parameters.length > 0) {
      const params = route.parameters
        .map((p, i) => `'${p}' => \${${i + 1}:value}`)
        .join(", ");
      item.detail += ` (${route.parameters.length} params)`;
    }

    return item;
  }

  private buildDocumentation(route: RouteInfo): string {
    const parts: string[] = [
      `**Route:** \`${route.name}\``,
      `**URI:** \`${route.methods.join("|")} /${route.uri}\``,
      `**Action:** \`${route.action}\``,
    ];

    if (route.middleware.length > 0) {
      parts.push(`**Middleware:** ${route.middleware.map((m) => `\`${m}\``).join(", ")}`);
    }

    if (route.parameters.length > 0) {
      parts.push(`**Parameters:** ${route.parameters.map((p) => `\`{${p}}\``).join(", ")}`);
    }

    return parts.join("\n\n");
  }
}
