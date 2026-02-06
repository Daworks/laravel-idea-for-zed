import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
} from "vscode-languageserver";
import {
  BladeComponentRepository,
  BladeComponentInfo,
} from "../../repositories/blade-components";

/** Built-in Blade directives with snippet support */
const BLADE_DIRECTIVES: Array<{
  name: string;
  snippet: string;
  description: string;
}> = [
  { name: "if", snippet: "@if(${1:condition})\n\t$0\n@endif", description: "Conditional block" },
  { name: "elseif", snippet: "@elseif(${1:condition})", description: "Else-if condition" },
  { name: "else", snippet: "@else", description: "Else branch" },
  { name: "unless", snippet: "@unless(${1:condition})\n\t$0\n@endunless", description: "Negated conditional block" },
  { name: "isset", snippet: "@isset(${1:\\$variable})\n\t$0\n@endisset", description: "Isset check" },
  { name: "empty", snippet: "@empty(${1:\\$variable})\n\t$0\n@endempty", description: "Empty check" },
  { name: "auth", snippet: "@auth\n\t$0\n@endauth", description: "Auth check" },
  { name: "guest", snippet: "@guest\n\t$0\n@endguest", description: "Guest check" },
  { name: "switch", snippet: "@switch(${1:\\$variable})\n\t@case(${2:value})\n\t\t$0\n\t\t@break\n\t@default\n\t\t\n@endswitch", description: "Switch statement" },
  { name: "for", snippet: "@for(${1:\\$i = 0; \\$i < ${2:count}; \\$i++})\n\t$0\n@endfor", description: "For loop" },
  { name: "foreach", snippet: "@foreach(${1:\\$items} as ${2:\\$item})\n\t$0\n@endforeach", description: "Foreach loop" },
  { name: "forelse", snippet: "@forelse(${1:\\$items} as ${2:\\$item})\n\t$0\n@empty\n\t\n@endforelse", description: "Foreach with empty fallback" },
  { name: "while", snippet: "@while(${1:condition})\n\t$0\n@endwhile", description: "While loop" },
  { name: "continue", snippet: "@continue", description: "Continue loop iteration" },
  { name: "break", snippet: "@break", description: "Break loop" },
  { name: "include", snippet: "@include('${1:view}')", description: "Include a view" },
  { name: "includeIf", snippet: "@includeIf('${1:view}')", description: "Include a view if it exists" },
  { name: "includeWhen", snippet: "@includeWhen(${1:condition}, '${2:view}')", description: "Include a view conditionally" },
  { name: "includeFirst", snippet: "@includeFirst([${1:'view1', 'view2'}])", description: "Include first existing view" },
  { name: "each", snippet: "@each('${1:view}', ${2:\\$items}, '${3:item}')", description: "Render view for each item" },
  { name: "extends", snippet: "@extends('${1:layout}')", description: "Extend a layout" },
  { name: "section", snippet: "@section('${1:name}')\n\t$0\n@endsection", description: "Define a section" },
  { name: "yield", snippet: "@yield('${1:name}')", description: "Yield section content" },
  { name: "show", snippet: "@show", description: "End section and yield" },
  { name: "parent", snippet: "@parent", description: "Display parent section content" },
  { name: "component", snippet: "@component('${1:component}')\n\t$0\n@endcomponent", description: "Render a component" },
  { name: "slot", snippet: "@slot('${1:name}')\n\t$0\n@endslot", description: "Define a slot" },
  { name: "push", snippet: "@push('${1:name}')\n\t$0\n@endpush", description: "Push content to a stack" },
  { name: "prepend", snippet: "@prepend('${1:name}')\n\t$0\n@endprepend", description: "Prepend content to a stack" },
  { name: "stack", snippet: "@stack('${1:name}')", description: "Render a stack" },
  { name: "once", snippet: "@once\n\t$0\n@endonce", description: "Render content only once" },
  { name: "props", snippet: "@props([${1:'key' => ${2:default}}])", description: "Define component props" },
  { name: "aware", snippet: "@aware([${1:'key'}])", description: "Access parent component data" },
  { name: "class", snippet: "@class([${1:'class' => ${2:condition}}])", description: "Conditional CSS classes" },
  { name: "style", snippet: "@style([${1:'style' => ${2:condition}}])", description: "Conditional inline styles" },
  { name: "checked", snippet: "@checked(${1:condition})", description: "Conditionally add checked attribute" },
  { name: "selected", snippet: "@selected(${1:condition})", description: "Conditionally add selected attribute" },
  { name: "disabled", snippet: "@disabled(${1:condition})", description: "Conditionally add disabled attribute" },
  { name: "readonly", snippet: "@readonly(${1:condition})", description: "Conditionally add readonly attribute" },
  { name: "required", snippet: "@required(${1:condition})", description: "Conditionally add required attribute" },
  { name: "error", snippet: "@error('${1:field}')\n\t$0\n@enderror", description: "Display validation error" },
  { name: "csrf", snippet: "@csrf", description: "CSRF token hidden field" },
  { name: "method", snippet: "@method('${1:PUT}')", description: "HTTP method spoofing" },
  { name: "dump", snippet: "@dump(${1:\\$variable})", description: "Dump a variable" },
  { name: "dd", snippet: "@dd(${1:\\$variable})", description: "Dump and die" },
  { name: "env", snippet: "@env('${1:production}')\n\t$0\n@endenv", description: "Environment check" },
  { name: "production", snippet: "@production\n\t$0\n@endproduction", description: "Production environment check" },
  { name: "php", snippet: "@php\n\t$0\n@endphp", description: "Inline PHP code" },
  { name: "verbatim", snippet: "@verbatim\n\t$0\n@endverbatim", description: "Display raw Blade syntax" },
  { name: "vite", snippet: "@vite('${1:resources/js/app.js}')", description: "Include Vite assets" },
  { name: "livewire", snippet: "@livewire('${1:component}')", description: "Render Livewire component" },
  { name: "livewireStyles", snippet: "@livewireStyles", description: "Include Livewire styles" },
  { name: "livewireScripts", snippet: "@livewireScripts", description: "Include Livewire scripts" },
  { name: "can", snippet: "@can('${1:ability}')\n\t$0\n@endcan", description: "Authorization check" },
  { name: "cannot", snippet: "@cannot('${1:ability}')\n\t$0\n@endcannot", description: "Authorization denial check" },
  { name: "canany", snippet: "@canany([${1:'ability1', 'ability2'}])\n\t$0\n@endcanany", description: "Any authorization check" },
  { name: "json", snippet: "@json(${1:\\$data})", description: "Encode data as JSON" },
  { name: "js", snippet: "@js(${1:\\$data})", description: "Render data as JavaScript" },
];

/**
 * Provides Blade template completions:
 * - Blade directives (@if, @foreach, etc.)
 * - Blade components (<x-component>)
 * - Component props
 */
export class BladeCompletionProvider {
  constructor(private componentRepository: BladeComponentRepository) {}

  /** Provide Blade directive completions */
  provideDirectiveCompletions(prefix: string): CompletionItem[] {
    const lower = prefix.toLowerCase();
    return BLADE_DIRECTIVES.filter(
      (d) => !prefix || d.name.toLowerCase().includes(lower)
    ).map((d, i) => ({
      label: `@${d.name}`,
      kind: CompletionItemKind.Snippet,
      detail: d.description,
      documentation: {
        kind: MarkupKind.Markdown,
        value: `**Blade Directive:** \`@${d.name}\`\n\n${d.description}`,
      },
      sortText: String(i).padStart(5, "0"),
      insertText: d.snippet,
      insertTextFormat: InsertTextFormat.Snippet,
    }));
  }

  /** Provide Blade component completions for <x-...> tags */
  provideComponentCompletions(prefix: string): CompletionItem[] {
    const components = this.componentRepository.search(prefix);
    return components.map((comp, i) =>
      this.toComponentCompletionItem(comp, i)
    );
  }

  /** Provide component prop completions */
  provideComponentPropCompletions(
    componentName: string,
    prefix: string
  ): CompletionItem[] {
    const component = this.componentRepository.findByName(componentName);
    if (!component) return [];

    const lower = prefix.toLowerCase();
    return component.props
      .filter((p) => !prefix || p.name.toLowerCase().includes(lower))
      .map((prop, i) => ({
        label: prop.name,
        kind: CompletionItemKind.Property,
        detail: prop.type
          ? `${prop.type}${prop.required ? "" : "?"}`
          : prop.required
            ? "required"
            : "optional",
        documentation: {
          kind: MarkupKind.Markdown,
          value: [
            `**Prop:** \`${prop.name}\``,
            prop.type ? `**Type:** \`${prop.type}\`` : "",
            prop.default !== undefined ? `**Default:** \`${prop.default}\`` : "",
            prop.required ? "**Required**" : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
        sortText: String(i).padStart(5, "0"),
        insertText: prop.name,
        insertTextFormat: InsertTextFormat.PlainText,
      }));
  }

  private toComponentCompletionItem(
    comp: BladeComponentInfo,
    index: number
  ): CompletionItem {
    const propsStr =
      comp.props.length > 0
        ? `\n\n**Props:** ${comp.props.map((p) => `\`${p.name}\``).join(", ")}`
        : "";

    return {
      label: comp.name,
      kind: CompletionItemKind.Module,
      detail: `${comp.type} component`,
      documentation: {
        kind: MarkupKind.Markdown,
        value: `**Component:** \`<x-${comp.name}>\`\n\n**Type:** ${comp.type}\n\n**File:** \`${comp.filePath}\`${propsStr}`,
      },
      sortText: String(index).padStart(5, "0"),
      filterText: comp.name,
      insertText: comp.name,
      insertTextFormat: InsertTextFormat.PlainText,
    };
  }
}
