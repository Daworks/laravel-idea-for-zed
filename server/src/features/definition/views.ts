import { Definition, Location } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { ViewRepository } from "../../repositories/views";

/**
 * Provides go-to-definition for view names.
 * Navigates to the blade template file.
 */
export class ViewDefinitionProvider {
  constructor(private repository: ViewRepository) {}

  provideDefinition(viewName: string): Definition | null {
    const view = this.repository.findByName(viewName);
    if (!view) return null;

    return Location.create(URI.file(view.absolutePath).toString(), {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    });
  }
}
