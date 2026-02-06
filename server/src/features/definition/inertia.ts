import { Definition, Location } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { InertiaRepository } from "../../repositories/inertia";

/**
 * Provides go-to-definition for Inertia page references.
 */
export class InertiaDefinitionProvider {
  constructor(private repository: InertiaRepository) {}

  provideDefinition(pageName: string): Definition | null {
    const page = this.repository.findByName(pageName);
    if (!page) return null;

    return Location.create(URI.file(page.absolutePath).toString(), {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    });
  }
}
