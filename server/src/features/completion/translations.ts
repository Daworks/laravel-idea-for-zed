import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
} from "vscode-languageserver";
import { TranslationRepository } from "../../repositories/translations";
import { TranslationInfo } from "../../types";

/**
 * Provides translation key completions for __(), trans(), @lang(), etc.
 */
export class TranslationCompletionProvider {
  constructor(private repository: TranslationRepository) {}

  provideCompletions(prefix: string): CompletionItem[] {
    const translations = this.repository.search(prefix);
    return translations.map((t, index) => this.toCompletionItem(t, index));
  }

  private toCompletionItem(
    translation: TranslationInfo,
    sortIndex: number
  ): CompletionItem {
    const detail = translation.value
      ? translation.value.length > 60
        ? translation.value.substring(0, 60) + "..."
        : translation.value
      : `[${translation.locale}]`;

    return {
      label: translation.key,
      kind: CompletionItemKind.Text,
      detail,
      documentation: {
        kind: MarkupKind.Markdown,
        value: [
          `**Translation:** \`${translation.key}\``,
          translation.value ? `**Value:** ${translation.value}` : "",
          `**Locale:** \`${translation.locale}\``,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
      sortText: String(sortIndex).padStart(5, "0"),
      filterText: translation.key,
      insertText: translation.key,
      insertTextFormat: InsertTextFormat.PlainText,
    };
  }
}
