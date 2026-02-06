import { Definition, Location } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { ModelRepository } from "../../repositories/models";
import * as path from "path";
import * as fs from "fs";

/**
 * Provides go-to-definition for Eloquent model references.
 */
export class EloquentDefinitionProvider {
  constructor(
    private repository: ModelRepository,
    private projectPath: string
  ) {}

  provideDefinition(modelName: string): Definition | null {
    const model = this.repository.findByName(modelName);
    if (!model) return null;

    const filePath = path.isAbsolute(model.filePath)
      ? model.filePath
      : path.join(this.projectPath, model.filePath);

    if (!fs.existsSync(filePath)) return null;

    return Location.create(URI.file(filePath).toString(), {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    });
  }

  /** Go to a specific relation method within a model */
  provideRelationDefinition(
    modelName: string,
    relationName: string
  ): Definition | null {
    const model = this.repository.findByName(modelName);
    if (!model) return null;

    const filePath = path.isAbsolute(model.filePath)
      ? model.filePath
      : path.join(this.projectPath, model.filePath);

    if (!fs.existsSync(filePath)) return null;

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      const pattern = new RegExp(
        `\\bfunction\\s+${escapeRegex(relationName)}\\s*\\(`
      );

      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          const charIndex = lines[i].indexOf(relationName);
          return Location.create(URI.file(filePath).toString(), {
            start: { line: i, character: Math.max(0, charIndex) },
            end: {
              line: i,
              character: Math.max(0, charIndex) + relationName.length,
            },
          });
        }
      }
    } catch {
      // fall through
    }

    return Location.create(URI.file(filePath).toString(), {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    });
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
