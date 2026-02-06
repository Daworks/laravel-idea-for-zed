import { Connection } from "vscode-languageserver";
import { PhpRunner } from "../analyzer/php";
import { ModelInfo, ModelAttribute, ModelRelation } from "../types";
import { BoundedCache } from "../support/cache";

/**
 * Repository for collecting Eloquent model metadata.
 * Uses PHP Reflection + Schema to gather fields, relations, and scopes.
 */
export class ModelRepository {
  private models: ModelInfo[] = [];
  private modelsByName: Map<string, ModelInfo> = new Map();
  private modelsByTable: Map<string, ModelInfo> = new Map();
  private cache: BoundedCache<ModelInfo[]>;
  private loading = false;

  constructor(
    private php: PhpRunner,
    private connection: Connection
  ) {
    this.cache = new BoundedCache<ModelInfo[]>(10, 10 * 60 * 1000);
  }

  async load(): Promise<void> {
    if (this.loading) return;

    const cached = this.cache.get("models");
    if (cached) {
      this.setModels(cached);
      return;
    }

    this.loading = true;
    try {
      const phpCode = `
$projectPath = base_path();

// Find all model files under app/ (and common subdirectories)
$modelDirs = [app_path(), app_path('Models')];
$modelFiles = [];
foreach ($modelDirs as $dir) {
    if (!is_dir($dir)) continue;
    $iterator = new \\RecursiveIteratorIterator(
        new \\RecursiveDirectoryIterator($dir, \\FilesystemIterator::SKIP_DOTS)
    );
    foreach ($iterator as $file) {
        if ($file->getExtension() === 'php') {
            $modelFiles[] = $file->getRealPath();
        }
    }
}

$models = [];
foreach ($modelFiles as $file) {
    $content = file_get_contents($file);

    // Extract namespace and class name
    if (!preg_match('/namespace\\s+([^;]+)/', $content, $nsMatch)) continue;
    if (!preg_match('/class\\s+(\\w+)\\s+extends\\s+[^{]*Model/', $content, $classMatch)) continue;

    $fqcn = $nsMatch[1] . '\\\\' . $classMatch[1];
    if (!class_exists($fqcn)) continue;

    try {
        $reflection = new \\ReflectionClass($fqcn);
        if ($reflection->isAbstract()) continue;

        $instance = $reflection->newInstanceWithoutConstructor();
        if (!($instance instanceof \\Illuminate\\Database\\Eloquent\\Model)) continue;

        $table = $instance->getTable();
        $relativePath = str_starts_with($file, $projectPath)
            ? substr($file, strlen($projectPath) + 1)
            : $file;

        // Get columns from DB schema
        $attributes = [];
        try {
            $columns = \\Illuminate\\Support\\Facades\\Schema::getColumnListing($table);
            foreach ($columns as $col) {
                $type = 'string';
                try {
                    $type = \\Illuminate\\Support\\Facades\\Schema::getColumnType($table, $col);
                } catch (\\Throwable $e) {}
                $attributes[] = [
                    'name' => $col,
                    'type' => $type,
                    'nullable' => false,
                    'cast' => null,
                ];
            }
        } catch (\\Throwable $e) {}

        // Override with casts
        $casts = $instance->getCasts();
        foreach ($attributes as &$attr) {
            if (isset($casts[$attr['name']])) {
                $attr['cast'] = $casts[$attr['name']];
            }
        }
        unset($attr);

        // Get relations by parsing source code for relation return types
        $relations = [];
        $relationTypes = [
            'hasOne', 'hasMany', 'belongsTo', 'belongsToMany',
            'morphOne', 'morphMany', 'morphTo', 'morphToMany', 'morphedByMany',
            'hasOneThrough', 'hasManyThrough',
        ];
        $pattern = '/public\\s+function\\s+(\\w+)\\s*\\([^)]*\\)[^{]*\\{[^}]*\\$this->('. implode('|', $relationTypes) .')\\s*\\(\\s*([\\w\\\\:]+::class|[\'"][\\w\\\\\\\\]+[\'"])/s';
        if (preg_match_all($pattern, $content, $relMatches, PREG_SET_ORDER)) {
            foreach ($relMatches as $rm) {
                $relName = $rm[1];
                $relType = $rm[2];
                $relModel = $rm[3];
                // Clean up model reference
                $relModel = str_replace(['::class', "'", '"'], '', $relModel);
                $relModel = class_basename(str_replace('\\\\\\\\', '\\\\', $relModel));
                $relations[] = [
                    'name' => $relName,
                    'type' => $relType,
                    'relatedModel' => $relModel,
                ];
            }
        }

        // Get scopes
        $scopes = [];
        foreach ($reflection->getMethods(\\ReflectionMethod::IS_PUBLIC) as $method) {
            if ($method->class !== $fqcn) continue;
            $name = $method->getName();
            if (str_starts_with($name, 'scope') && strlen($name) > 5) {
                $scopes[] = lcfirst(substr($name, 5));
            }
        }

        $models[] = [
            'name' => $classMatch[1],
            'fqcn' => $fqcn,
            'tableName' => $table,
            'filePath' => $relativePath,
            'attributes' => $attributes,
            'relations' => $relations,
            'scopes' => $scopes,
        ];
    } catch (\\Throwable $e) {
        // Skip models that can't be instantiated
    }
}

echo json_encode($models);
`;

      const output = await this.php.runInLaravel(phpCode);
      const rawModels: RawModelData[] = JSON.parse(output);
      const models = rawModels.map((r) => this.toModelInfo(r));

      this.setModels(models);
      this.cache.set("models", models);
      this.connection.console.log(
        `[Models] Loaded ${models.length} Eloquent models`
      );
    } catch (e) {
      this.connection.console.log(`[Models] Failed to load: ${e}`);
    } finally {
      this.loading = false;
    }
  }

  async reload(): Promise<void> {
    this.cache.clear();
    await this.load();
  }

  findByName(name: string): ModelInfo | undefined {
    return this.modelsByName.get(name);
  }

  findByTable(tableName: string): ModelInfo | undefined {
    return this.modelsByTable.get(tableName);
  }

  search(query: string): ModelInfo[] {
    if (!query) return this.models;
    const lower = query.toLowerCase();
    return this.models.filter((m) => m.name.toLowerCase().includes(lower));
  }

  getAll(): ModelInfo[] {
    return this.models;
  }

  count(): number {
    return this.models.length;
  }

  /** Get all attribute names for a model */
  getAttributes(modelName: string): ModelAttribute[] {
    return this.modelsByName.get(modelName)?.attributes ?? [];
  }

  /** Get all relation names for a model */
  getRelations(modelName: string): ModelRelation[] {
    return this.modelsByName.get(modelName)?.relations ?? [];
  }

  /** Get all scope names for a model */
  getScopes(modelName: string): string[] {
    return this.modelsByName.get(modelName)?.scopes ?? [];
  }

  private setModels(models: ModelInfo[]): void {
    this.models = models;
    this.modelsByName.clear();
    this.modelsByTable.clear();
    for (const model of models) {
      this.modelsByName.set(model.name, model);
      this.modelsByTable.set(model.tableName, model);
    }
  }

  private toModelInfo(raw: RawModelData): ModelInfo {
    return {
      name: raw.name,
      tableName: raw.tableName,
      filePath: raw.filePath,
      attributes: raw.attributes.map((a) => ({
        name: a.name,
        type: a.type,
        nullable: a.nullable ?? false,
        default: a.default ?? undefined,
        cast: a.cast ?? undefined,
      })),
      relations: raw.relations.map((r) => ({
        name: r.name,
        type: r.type,
        relatedModel: r.relatedModel,
      })),
      scopes: raw.scopes,
    };
  }
}

interface RawModelData {
  name: string;
  fqcn: string;
  tableName: string;
  filePath: string;
  attributes: Array<{
    name: string;
    type: string;
    nullable?: boolean;
    default?: string | null;
    cast?: string | null;
  }>;
  relations: Array<{
    name: string;
    type: string;
    relatedModel: string;
  }>;
  scopes: string[];
}
