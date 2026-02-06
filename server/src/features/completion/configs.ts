import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
} from "vscode-languageserver";
import { ConfigRepository } from "../../repositories/configs";
import { ConfigInfo } from "../../types";

/**
 * Provides config key completions for config(), Config::get(), etc.
 */
export class ConfigCompletionProvider {
  constructor(private repository: ConfigRepository) {}

  provideCompletions(prefix: string): CompletionItem[] {
    const configs = this.repository.search(prefix);
    return configs.map((config, index) =>
      this.toCompletionItem(config, index)
    );
  }

  private toCompletionItem(config: ConfigInfo, sortIndex: number): CompletionItem {
    const isGroup = config.hasChildren;

    return {
      label: config.key,
      kind: isGroup ? CompletionItemKind.Module : CompletionItemKind.Value,
      detail: isGroup ? "[array]" : config.value,
      documentation: {
        kind: MarkupKind.Markdown,
        value: [
          `**Config:** \`${config.key}\``,
          `**Value:** \`${config.value}\``,
          `**File:** \`${config.file}\``,
        ].join("\n\n"),
      },
      sortText: String(sortIndex).padStart(5, "0"),
      filterText: config.key,
      insertText: config.key,
      insertTextFormat: InsertTextFormat.PlainText,
    };
  }
}
