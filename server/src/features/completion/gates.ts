import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
} from "vscode-languageserver";
import { GateRepository } from "../../repositories/gates";

/**
 * Provides completions for Gate and Policy ability names.
 * Handles Gate::allows('ability'), @can('ability'), $user->can('ability'), etc.
 */
export class GateCompletionProvider {
  constructor(private repository: GateRepository) {}

  provideCompletions(prefix: string): CompletionItem[] {
    const items: CompletionItem[] = [];
    let sortIdx = 0;

    // Gates
    const gates = this.repository.searchGates(prefix);
    for (const gate of gates) {
      items.push({
        label: gate.name,
        kind: CompletionItemKind.Event,
        detail: gate.handler ? `Gate → ${gate.handler}` : "Gate",
        documentation: {
          kind: MarkupKind.Markdown,
          value: `**Gate:** \`${gate.name}\`${gate.handler ? `\n\n**Handler:** \`${gate.handler}\`` : ""}`,
        },
        sortText: String(sortIdx++).padStart(5, "0"),
        insertText: gate.name,
        insertTextFormat: InsertTextFormat.PlainText,
      });
    }

    // Policy abilities
    const policies = this.repository.searchPolicies(prefix);
    for (const policy of policies) {
      const lower = prefix.toLowerCase();
      for (const ability of policy.abilities) {
        if (prefix && !ability.toLowerCase().includes(lower)) continue;
        items.push({
          label: ability,
          kind: CompletionItemKind.Method,
          detail: `Policy: ${policy.model}`,
          documentation: {
            kind: MarkupKind.Markdown,
            value: `**Policy Ability:** \`${ability}\`\n\n**Model:** \`${policy.model}\`\n\n**Policy:** \`${policy.policyClass}\``,
          },
          sortText: String(sortIdx++).padStart(5, "0"),
          insertText: ability,
          insertTextFormat: InsertTextFormat.PlainText,
        });
      }
    }

    return items;
  }
}
