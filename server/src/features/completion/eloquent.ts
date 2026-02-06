import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
} from "vscode-languageserver";
import { ModelRepository } from "../../repositories/models";
import { ModelInfo, ModelAttribute, ModelRelation } from "../../types";

/**
 * Provides Eloquent model completions:
 * - Column names for where(), orderBy(), select(), create(), etc.
 * - Relation names for with(), has(), whereHas(), etc.
 * - Scope names for query builder chains
 */
export class EloquentCompletionProvider {
  constructor(private repository: ModelRepository) {}

  /** Provide column/attribute completions for a model */
  provideAttributeCompletions(
    modelName: string,
    prefix: string
  ): CompletionItem[] {
    const model = this.repository.findByName(modelName);
    if (!model) return [];

    const lower = prefix.toLowerCase();
    return model.attributes
      .filter((a) => !prefix || a.name.toLowerCase().includes(lower))
      .map((attr, i) => this.toAttributeItem(attr, model, i));
  }

  /** Provide relation completions for with(), has(), etc. */
  provideRelationCompletions(
    modelName: string,
    prefix: string
  ): CompletionItem[] {
    const model = this.repository.findByName(modelName);
    if (!model) return [];

    const lower = prefix.toLowerCase();
    return model.relations
      .filter((r) => !prefix || r.name.toLowerCase().includes(lower))
      .map((rel, i) => this.toRelationItem(rel, model, i));
  }

  /** Provide scope completions for query builder */
  provideScopeCompletions(
    modelName: string,
    prefix: string
  ): CompletionItem[] {
    const model = this.repository.findByName(modelName);
    if (!model) return [];

    const lower = prefix.toLowerCase();
    return model.scopes
      .filter((s) => !prefix || s.toLowerCase().includes(lower))
      .map((scope, i) => this.toScopeItem(scope, model, i));
  }

  /** Provide combined completions (attributes + relations + scopes) */
  provideAllCompletions(
    modelName: string,
    prefix: string
  ): CompletionItem[] {
    return [
      ...this.provideAttributeCompletions(modelName, prefix),
      ...this.provideRelationCompletions(modelName, prefix),
      ...this.provideScopeCompletions(modelName, prefix),
    ];
  }

  /** Provide completions for string arguments like where('column'), orderBy('column') */
  provideColumnStringCompletions(
    modelName: string,
    prefix: string
  ): CompletionItem[] {
    const model = this.repository.findByName(modelName);
    if (!model) return [];

    const lower = prefix.toLowerCase();
    return model.attributes
      .filter((a) => !prefix || a.name.toLowerCase().includes(lower))
      .map((attr, i) => ({
        label: attr.name,
        kind: CompletionItemKind.Field,
        detail: `${attr.type}${attr.cast ? ` (cast: ${attr.cast})` : ""}`,
        documentation: {
          kind: MarkupKind.Markdown,
          value: `**Column:** \`${attr.name}\`\n\n**Type:** \`${attr.type}\`\n\n**Table:** \`${model.tableName}\``,
        },
        sortText: String(i).padStart(5, "0"),
        insertText: attr.name,
        insertTextFormat: InsertTextFormat.PlainText,
      }));
  }

  /** Provide model name completions for relation methods, etc. */
  provideModelNameCompletions(prefix: string): CompletionItem[] {
    const models = this.repository.search(prefix);
    return models.map((model, i) => ({
      label: model.name,
      kind: CompletionItemKind.Class,
      detail: `table: ${model.tableName}`,
      documentation: {
        kind: MarkupKind.Markdown,
        value: [
          `**Model:** \`${model.name}\``,
          `**Table:** \`${model.tableName}\``,
          `**Attributes:** ${model.attributes.length}`,
          `**Relations:** ${model.relations.map((r) => r.name).join(", ") || "none"}`,
        ].join("\n\n"),
      },
      sortText: String(i).padStart(5, "0"),
      insertText: model.name,
      insertTextFormat: InsertTextFormat.PlainText,
    }));
  }

  private toAttributeItem(
    attr: ModelAttribute,
    model: ModelInfo,
    index: number
  ): CompletionItem {
    return {
      label: attr.name,
      kind: CompletionItemKind.Field,
      detail: `${attr.type}${attr.nullable ? "?" : ""}${attr.cast ? ` → ${attr.cast}` : ""}`,
      documentation: {
        kind: MarkupKind.Markdown,
        value: [
          `**Column:** \`${model.tableName}.${attr.name}\``,
          `**Type:** \`${attr.type}\``,
          attr.cast ? `**Cast:** \`${attr.cast}\`` : "",
          attr.nullable ? "**Nullable**" : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
      sortText: `0${String(index).padStart(5, "0")}`,
      insertText: attr.name,
      insertTextFormat: InsertTextFormat.PlainText,
    };
  }

  private toRelationItem(
    rel: ModelRelation,
    model: ModelInfo,
    index: number
  ): CompletionItem {
    return {
      label: rel.name,
      kind: CompletionItemKind.Reference,
      detail: `${rel.type} → ${rel.relatedModel}`,
      documentation: {
        kind: MarkupKind.Markdown,
        value: `**Relation:** \`${model.name}::${rel.name}()\`\n\n**Type:** \`${rel.type}\`\n\n**Related:** \`${rel.relatedModel}\``,
      },
      sortText: `1${String(index).padStart(5, "0")}`,
      insertText: rel.name,
      insertTextFormat: InsertTextFormat.PlainText,
    };
  }

  private toScopeItem(
    scope: string,
    model: ModelInfo,
    index: number
  ): CompletionItem {
    return {
      label: scope,
      kind: CompletionItemKind.Method,
      detail: `scope on ${model.name}`,
      documentation: {
        kind: MarkupKind.Markdown,
        value: `**Scope:** \`${model.name}::${scope}()\`\n\nDefined as \`scope${scope.charAt(0).toUpperCase() + scope.slice(1)}()\``,
      },
      sortText: `2${String(index).padStart(5, "0")}`,
      insertText: scope,
      insertTextFormat: InsertTextFormat.PlainText,
    };
  }
}
