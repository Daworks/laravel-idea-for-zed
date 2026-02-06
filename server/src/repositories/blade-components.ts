import { Connection } from "vscode-languageserver";
import * as fs from "fs";
import * as path from "path";
import { BoundedCache } from "../support/cache";

export interface BladeComponentInfo {
  /** Tag name: e.g., "alert", "forms.input" */
  name: string;
  /** Component type: anonymous (blade file) or class-based */
  type: "anonymous" | "class";
  /** File path (relative to project) */
  filePath: string;
  /** Absolute file path */
  absolutePath: string;
  /** Component props (from @props directive or class properties) */
  props: BladeComponentProp[];
}

export interface BladeComponentProp {
  name: string;
  type?: string;
  default?: string;
  required: boolean;
}

/**
 * Repository for Blade components.
 * Scans resources/views/components/ for anonymous components
 * and app/View/Components/ for class-based components.
 */
export class BladeComponentRepository {
  private components: BladeComponentInfo[] = [];
  private componentsByName: Map<string, BladeComponentInfo> = new Map();
  private cache: BoundedCache<BladeComponentInfo[]>;

  constructor(
    private projectPath: string,
    private connection: Connection
  ) {
    this.cache = new BoundedCache<BladeComponentInfo[]>(10, 10 * 60 * 1000);
  }

  async load(): Promise<void> {
    const cached = this.cache.get("blade-components");
    if (cached) {
      this.setComponents(cached);
      return;
    }

    try {
      const components: BladeComponentInfo[] = [];

      // 1. Scan anonymous components (resources/views/components/)
      const anonymousDir = path.join(
        this.projectPath,
        "resources",
        "views",
        "components"
      );
      if (fs.existsSync(anonymousDir)) {
        this.scanAnonymousComponents(anonymousDir, anonymousDir, components);
      }

      // 2. Scan class-based components (app/View/Components/)
      const classDir = path.join(
        this.projectPath,
        "app",
        "View",
        "Components"
      );
      if (fs.existsSync(classDir)) {
        this.scanClassComponents(classDir, classDir, components);
      }

      this.setComponents(components);
      this.cache.set("blade-components", components);
      this.connection.console.log(
        `[BladeComponents] Loaded ${components.length} components`
      );
    } catch (e) {
      this.connection.console.log(`[BladeComponents] Failed to load: ${e}`);
    }
  }

  async reload(): Promise<void> {
    this.cache.clear();
    await this.load();
  }

  findByName(name: string): BladeComponentInfo | undefined {
    return this.componentsByName.get(name);
  }

  search(query: string): BladeComponentInfo[] {
    if (!query) return this.components;
    const lower = query.toLowerCase();
    return this.components.filter((c) =>
      c.name.toLowerCase().includes(lower)
    );
  }

  getAll(): BladeComponentInfo[] {
    return this.components;
  }

  count(): number {
    return this.components.length;
  }

  private setComponents(components: BladeComponentInfo[]): void {
    this.components = components;
    this.componentsByName.clear();
    for (const c of components) {
      this.componentsByName.set(c.name, c);
    }
  }

  private scanAnonymousComponents(
    dir: string,
    baseDir: string,
    result: BladeComponentInfo[]
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
        this.scanAnonymousComponents(fullPath, baseDir, result);
      } else if (entry.name.endsWith(".blade.php")) {
        const relativePath = path.relative(baseDir, fullPath);
        const componentName = relativePath
          .replace(/\.blade\.php$/, "")
          .replace(/\/index$/, "")
          .replace(/\//g, ".")
          .replace(/\\/g, ".");

        // Parse @props from the blade file
        const props = this.parseAnonymousProps(fullPath);

        result.push({
          name: componentName,
          type: "anonymous",
          filePath: path.relative(this.projectPath, fullPath),
          absolutePath: fullPath,
          props,
        });
      }
    }
  }

  private scanClassComponents(
    dir: string,
    baseDir: string,
    result: BladeComponentInfo[]
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
        this.scanClassComponents(fullPath, baseDir, result);
      } else if (entry.name.endsWith(".php")) {
        const relativePath = path.relative(baseDir, fullPath);
        // Convert PascalCase to kebab-case for component name
        const componentName = relativePath
          .replace(/\.php$/, "")
          .replace(/\//g, ".")
          .replace(/\\/g, ".")
          .split(".")
          .map((part) => this.toKebabCase(part))
          .join(".");

        const props = this.parseClassProps(fullPath);

        result.push({
          name: componentName,
          type: "class",
          filePath: path.relative(this.projectPath, fullPath),
          absolutePath: fullPath,
          props,
        });
      }
    }
  }

  /** Parse @props(['key' => default]) from anonymous blade components */
  private parseAnonymousProps(filePath: string): BladeComponentProp[] {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const propsMatch = content.match(/@props\s*\(\s*\[([\s\S]*?)\]\s*\)/);
      if (!propsMatch) return [];

      const props: BladeComponentProp[] = [];
      // Match 'propName' => default or 'propName'
      const propMatches = Array.from(
        propsMatch[1].matchAll(/['"](\w+)['"]\s*(?:=>\s*(.+?))?(?:,|$)/g)
      );
      for (const m of propMatches) {
        props.push({
          name: m[1],
          default: m[2]?.trim(),
          required: !m[2],
        });
      }
      return props;
    } catch {
      return [];
    }
  }

  /** Parse constructor parameters from class-based components */
  private parseClassProps(filePath: string): BladeComponentProp[] {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const props: BladeComponentProp[] = [];

      // Match public constructor parameters
      const constructorMatch = content.match(
        /function\s+__construct\s*\(([\s\S]*?)\)/
      );
      if (!constructorMatch) return [];

      // Parse each parameter
      const paramMatches = Array.from(
        constructorMatch[1].matchAll(
          /(?:public\s+)?(?:(\?\w+|\w+)\s+)?\$(\w+)(?:\s*=\s*(.+?))?(?:,|$)/g
        )
      );
      for (const m of paramMatches) {
        props.push({
          name: this.toKebabCase(m[2]),
          type: m[1] || undefined,
          default: m[3]?.trim(),
          required: !m[3],
        });
      }
      return props;
    } catch {
      return [];
    }
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
      .toLowerCase();
  }
}
