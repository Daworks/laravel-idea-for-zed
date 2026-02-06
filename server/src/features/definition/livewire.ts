import { Definition, Location } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { LivewireRepository } from "../../repositories/livewire";

/**
 * Provides go-to-definition for Livewire component references.
 */
export class LivewireDefinitionProvider {
  constructor(private repository: LivewireRepository) {}

  provideDefinition(componentName: string): Definition | null {
    const component = this.repository.findByName(componentName);
    if (!component) return null;

    return Location.create(URI.file(component.absolutePath).toString(), {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    });
  }
}
