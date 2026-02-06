import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
} from "vscode-languageserver";
import { ViewRepository } from "../../repositories/views";
import { ViewInfo } from "../../types";

/**
 * Provides view name completions for view(), View::make(), @include, @extends, etc.
 */
export class ViewCompletionProvider {
  constructor(private repository: ViewRepository) {}

  provideCompletions(prefix: string): CompletionItem[] {
    const views = this.repository.search(prefix);
    return views.map((view, index) => this.toCompletionItem(view, index));
  }

  private toCompletionItem(view: ViewInfo, sortIndex: number): CompletionItem {
    return {
      label: view.name,
      kind: CompletionItemKind.File,
      detail: view.relativePath,
      documentation: {
        kind: MarkupKind.Markdown,
        value: `**View:** \`${view.name}\`\n\n**Path:** \`${view.relativePath}\``,
      },
      sortText: String(sortIndex).padStart(5, "0"),
      filterText: view.name,
      insertText: view.name,
      insertTextFormat: InsertTextFormat.PlainText,
    };
  }
}
