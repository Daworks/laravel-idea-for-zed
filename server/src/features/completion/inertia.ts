import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
} from "vscode-languageserver";
import { InertiaRepository, InertiaPageInfo } from "../../repositories/inertia";

/**
 * Provides Inertia.js page name completions for Inertia::render('Page').
 */
export class InertiaCompletionProvider {
  constructor(private repository: InertiaRepository) {}

  provideCompletions(prefix: string): CompletionItem[] {
    const pages = this.repository.search(prefix);
    return pages.map((page, i) => this.toCompletionItem(page, i));
  }

  private toCompletionItem(
    page: InertiaPageInfo,
    index: number
  ): CompletionItem {
    return {
      label: page.name,
      kind: CompletionItemKind.File,
      detail: `${page.framework} page`,
      documentation: {
        kind: MarkupKind.Markdown,
        value: `**Inertia Page:** \`${page.name}\`\n\n**Framework:** ${page.framework}\n\n**File:** \`${page.filePath}\``,
      },
      sortText: String(index).padStart(5, "0"),
      filterText: page.name,
      insertText: page.name,
      insertTextFormat: InsertTextFormat.PlainText,
    };
  }
}
