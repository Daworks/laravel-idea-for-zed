import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
} from "vscode-languageserver";
import { ValidationRepository, ValidationRule } from "../../repositories/validation";

/**
 * Provides validation rule completions for Laravel validation strings.
 * Handles pipe-separated rules like: 'required|string|max:255'
 */
export class ValidationCompletionProvider {
  constructor(private repository: ValidationRepository) {}

  provideCompletions(prefix: string): CompletionItem[] {
    // Handle pipe-separated rules: "required|str" → prefix is "str"
    const lastRule = this.extractLastRule(prefix);
    const rules = this.repository.search(lastRule);
    return rules.map((rule, i) => this.toCompletionItem(rule, i, prefix, lastRule));
  }

  private extractLastRule(prefix: string): string {
    const parts = prefix.split("|");
    return parts[parts.length - 1].trim();
  }

  private toCompletionItem(
    rule: ValidationRule,
    index: number,
    _fullPrefix: string,
    _lastRule: string
  ): CompletionItem {
    const insertText = rule.hasParameters
      ? `${rule.name}:`
      : rule.name;

    return {
      label: rule.name,
      kind: CompletionItemKind.EnumMember,
      detail: rule.description,
      documentation: {
        kind: MarkupKind.Markdown,
        value: `**Rule:** \`${rule.name}\`\n\n${rule.description}${rule.hasParameters ? "\n\n*Accepts parameters*" : ""}`,
      },
      sortText: String(index).padStart(5, "0"),
      filterText: rule.name,
      insertText,
      insertTextFormat: InsertTextFormat.PlainText,
    };
  }
}
