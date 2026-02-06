import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
} from "vscode-languageserver";
import { MiddlewareRepository } from "../../repositories/middleware";
import { MiddlewareInfo } from "../../types";

/**
 * Provides middleware name completions for ->middleware(), Route::middleware(), etc.
 */
export class MiddlewareCompletionProvider {
  constructor(private repository: MiddlewareRepository) {}

  provideCompletions(prefix: string): CompletionItem[] {
    const middleware = this.repository.search(prefix);
    return middleware.map((m, index) => this.toCompletionItem(m, index));
  }

  private toCompletionItem(
    middleware: MiddlewareInfo,
    sortIndex: number
  ): CompletionItem {
    return {
      label: middleware.name,
      kind: CompletionItemKind.EnumMember,
      detail: middleware.class,
      documentation: {
        kind: MarkupKind.Markdown,
        value: [
          `**Middleware:** \`${middleware.name}\``,
          `**Class:** \`${middleware.class}\``,
        ].join("\n\n"),
      },
      sortText: String(sortIndex).padStart(5, "0"),
      filterText: middleware.name,
      insertText: middleware.name,
      insertTextFormat: InsertTextFormat.PlainText,
    };
  }
}
