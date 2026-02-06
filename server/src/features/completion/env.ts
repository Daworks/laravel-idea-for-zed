import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
} from "vscode-languageserver";
import { EnvRepository, EnvVariable } from "../../repositories/env";

/**
 * Provides env variable completions for env() calls.
 */
export class EnvCompletionProvider {
  constructor(private repository: EnvRepository) {}

  provideCompletions(prefix: string): CompletionItem[] {
    const variables = this.repository.search(prefix);
    return variables.map((v, index) => this.toCompletionItem(v, index));
  }

  private toCompletionItem(variable: EnvVariable, sortIndex: number): CompletionItem {
    return {
      label: variable.key,
      kind: CompletionItemKind.Variable,
      detail: variable.value || "(empty)",
      documentation: {
        kind: MarkupKind.Markdown,
        value: [
          `**Env:** \`${variable.key}\``,
          `**Value:** \`${variable.value || "(empty)"}\``,
          variable.comment ? `**Comment:** ${variable.comment}` : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
      sortText: String(sortIndex).padStart(5, "0"),
      filterText: variable.key,
      insertText: variable.key,
      insertTextFormat: InsertTextFormat.PlainText,
    };
  }
}
