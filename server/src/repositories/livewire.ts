import { Connection } from "vscode-languageserver";
import * as fs from "fs";
import * as path from "path";
import { BoundedCache } from "../support/cache";

export interface LivewireComponentInfo {
  /** Component name (kebab-case): e.g., "counter", "forms.create-post" */
  name: string;
  /** Full class name */
  className: string;
  /** File path relative to project */
  filePath: string;
  /** Absolute file path */
  absolutePath: string;
  /** Public properties */
  properties: LivewireProperty[];
  /** Public methods (actions) */
  methods: string[];
}

export interface LivewireProperty {
  name: string;
  type?: string;
}

/**
 * Repository for Livewire components.
 * Scans app/Livewire/ (Livewire v3) and app/Http/Livewire/ (v2).
 */
export class LivewireRepository {
  private components: LivewireComponentInfo[] = [];
  private componentsByName: Map<string, LivewireComponentInfo> = new Map();
  private cache: BoundedCache<LivewireComponentInfo[]>;

  constructor(
    private projectPath: string,
    private connection: Connection
  ) {
    this.cache = new BoundedCache<LivewireComponentInfo[]>(10, 10 * 60 * 1000);
  }

  async load(): Promise<void> {
    const cached = this.cache.get("livewire");
    if (cached) {
      this.setComponents(cached);
      return;
    }

    try {
      const components: LivewireComponentInfo[] = [];

      // Livewire v3: app/Livewire/
      const v3Dir = path.join(this.projectPath, "app", "Livewire");
      if (fs.existsSync(v3Dir)) {
        this.scanLivewireDir(v3Dir, v3Dir, "App\\Livewire", components);
      }

      // Livewire v2: app/Http/Livewire/
      const v2Dir = path.join(this.projectPath, "app", "Http", "Livewire");
      if (fs.existsSync(v2Dir)) {
        this.scanLivewireDir(v2Dir, v2Dir, "App\\Http\\Livewire", components);
      }

      this.setComponents(components);
      this.cache.set("livewire", components);
      this.connection.console.log(
        `[Livewire] Loaded ${components.length} components`
      );
    } catch (e) {
      this.connection.console.log(`[Livewire] Failed to load: ${e}`);
    }
  }

  async reload(): Promise<void> {
    this.cache.clear();
    await this.load();
  }

  findByName(name: string): LivewireComponentInfo | undefined {
    return this.componentsByName.get(name);
  }

  search(query: string): LivewireComponentInfo[] {
    if (!query) return this.components;
    const lower = query.toLowerCase();
    return this.components.filter((c) =>
      c.name.toLowerCase().includes(lower)
    );
  }

  getAll(): LivewireComponentInfo[] {
    return this.components;
  }

  count(): number {
    return this.components.length;
  }

  private setComponents(components: LivewireComponentInfo[]): void {
    this.components = components;
    this.componentsByName.clear();
    for (const c of components) {
      this.componentsByName.set(c.name, c);
    }
  }

  private scanLivewireDir(
    dir: string,
    baseDir: string,
    baseNamespace: string,
    result: LivewireComponentInfo[]
  ): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        this.scanLivewireDir(fullPath, baseDir, baseNamespace, result);
      } else if (entry.name.endsWith(".php")) {
        const relativePath = path.relative(baseDir, fullPath);
        const className = relativePath
          .replace(/\.php$/, "")
          .replace(/\//g, "\\")
          .replace(/\\/g, "\\");

        const componentName = relativePath
          .replace(/\.php$/, "")
          .split(/[/\\]/)
          .map((part) => this.toKebabCase(part))
          .join(".");

        const { properties, methods } = this.parseComponent(fullPath);

        result.push({
          name: componentName,
          className: `${baseNamespace}\\${className}`,
          filePath: path.relative(this.projectPath, fullPath),
          absolutePath: fullPath,
          properties,
          methods,
        });
      }
    }
  }

  private parseComponent(
    filePath: string
  ): { properties: LivewireProperty[]; methods: string[] } {
    const properties: LivewireProperty[] = [];
    const methods: string[] = [];

    try {
      const content = fs.readFileSync(filePath, "utf-8");

      // Find public properties using matchAll
      const propMatches = Array.from(
        content.matchAll(/public\s+(?:(\?\w+|\w+)\s+)?\$(\w+)/g)
      );
      for (const m of propMatches) {
        if (["id", "paginators", "page"].includes(m[2])) continue;
        properties.push({
          name: m[2],
          type: m[1] || undefined,
        });
      }

      // Find public methods (actions) - exclude lifecycle hooks
      const lifecycleHooks = new Set([
        "mount", "hydrate", "dehydrate", "render",
        "updating", "updated", "boot", "booted", "__construct",
      ]);
      const methodMatches = Array.from(
        content.matchAll(/public\s+function\s+(\w+)\s*\(/g)
      );
      for (const m of methodMatches) {
        const name = m[1];
        if (
          !lifecycleHooks.has(name) &&
          !name.startsWith("updating") &&
          !name.startsWith("updated")
        ) {
          methods.push(name);
        }
      }
    } catch {
      // ignore parse errors
    }

    return { properties, methods };
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
      .toLowerCase();
  }
}
