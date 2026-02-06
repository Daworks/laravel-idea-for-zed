import { Definition, Location } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { BladeComponentRepository } from "../../repositories/blade-components";

/**
 * Provides go-to-definition for Blade components.
 * Navigates to the component blade file or class file.
 */
export class BladeDefinitionProvider {
  constructor(private repository: BladeComponentRepository) {}

  provideDefinition(componentName: string): Definition | null {
    const component = this.repository.findByName(componentName);
    if (!component) return null;

    return Location.create(URI.file(component.absolutePath).toString(), {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    });
  }
}
