import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
} from "vscode-languageserver";
import { LivewireRepository, LivewireComponentInfo } from "../../repositories/livewire";

/**
 * Provides Livewire component name completions for @livewire('name')
 * and Livewire property/method completions.
 */
export class LivewireCompletionProvider {
  constructor(private repository: LivewireRepository) {}

  provideCompletions(prefix: string): CompletionItem[] {
    const components = this.repository.search(prefix);
    return components.map((comp, i) => this.toCompletionItem(comp, i));
  }

  providePropertyCompletions(
    componentName: string,
    prefix: string
  ): CompletionItem[] {
    const component = this.repository.findByName(componentName);
    if (!component) return [];

    const lower = prefix.toLowerCase();
    const items: CompletionItem[] = [];

    for (const [i, prop] of component.properties.entries()) {
      if (prefix && !prop.name.toLowerCase().includes(lower)) continue;
      items.push({
        label: prop.name,
        kind: CompletionItemKind.Property,
        detail: prop.type || "mixed",
        documentation: {
          kind: MarkupKind.Markdown,
          value: `**Livewire Property:** \`$${prop.name}\`\n\n**Component:** \`${component.className}\``,
        },
        sortText: `0${String(i).padStart(5, "0")}`,
        insertText: prop.name,
        insertTextFormat: InsertTextFormat.PlainText,
      });
    }

    for (const [i, method] of component.methods.entries()) {
      if (prefix && !method.toLowerCase().includes(lower)) continue;
      items.push({
        label: method,
        kind: CompletionItemKind.Method,
        detail: "action",
        documentation: {
          kind: MarkupKind.Markdown,
          value: `**Livewire Action:** \`${method}()\`\n\n**Component:** \`${component.className}\``,
        },
        sortText: `1${String(i).padStart(5, "0")}`,
        insertText: method,
        insertTextFormat: InsertTextFormat.PlainText,
      });
    }

    return items;
  }

  private toCompletionItem(
    comp: LivewireComponentInfo,
    index: number
  ): CompletionItem {
    const details: string[] = [];
    if (comp.properties.length > 0) {
      details.push(`Props: ${comp.properties.map((p) => p.name).join(", ")}`);
    }
    if (comp.methods.length > 0) {
      details.push(`Actions: ${comp.methods.join(", ")}`);
    }

    return {
      label: comp.name,
      kind: CompletionItemKind.Class,
      detail: comp.className,
      documentation: {
        kind: MarkupKind.Markdown,
        value: [
          `**Livewire Component:** \`${comp.name}\``,
          `**Class:** \`${comp.className}\``,
          `**File:** \`${comp.filePath}\``,
          ...details,
        ].join("\n\n"),
      },
      sortText: String(index).padStart(5, "0"),
      filterText: comp.name,
      insertText: comp.name,
      insertTextFormat: InsertTextFormat.PlainText,
    };
  }
}
