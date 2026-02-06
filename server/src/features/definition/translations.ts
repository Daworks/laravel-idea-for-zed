import { Definition, Location } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { TranslationRepository } from "../../repositories/translations";

/**
 * Provides go-to-definition for translation keys.
 * Navigates to the translation file (PHP array or JSON).
 */
export class TranslationDefinitionProvider {
  constructor(private repository: TranslationRepository) {}

  provideDefinition(translationKey: string): Definition | null {
    const translation = this.repository.findByKey(translationKey);
    if (!translation) return null;

    return Location.create(URI.file(translation.file).toString(), {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    });
  }
}
