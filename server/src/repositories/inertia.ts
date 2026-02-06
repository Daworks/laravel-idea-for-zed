import { Connection } from "vscode-languageserver";
import * as fs from "fs";
import * as path from "path";
import { BoundedCache } from "../support/cache";

export interface InertiaPageInfo {
  /** Page name: e.g., "Dashboard", "Users/Index" */
  name: string;
  /** File path relative to project */
  filePath: string;
  /** Absolute file path */
  absolutePath: string;
  /** Framework: vue, react, or svelte */
  framework: "vue" | "react" | "svelte" | "unknown";
}

/**
 * Repository for Inertia.js page components.
 * Scans resources/js/Pages/ directory for Vue/React/Svelte files.
 */
export class InertiaRepository {
  private pages: InertiaPageInfo[] = [];
  private pagesByName: Map<string, InertiaPageInfo> = new Map();
  private cache: BoundedCache<InertiaPageInfo[]>;

  constructor(
    private projectPath: string,
    private connection: Connection
  ) {
    this.cache = new BoundedCache<InertiaPageInfo[]>(10, 10 * 60 * 1000);
  }

  async load(): Promise<void> {
    const cached = this.cache.get("inertia");
    if (cached) {
      this.setPages(cached);
      return;
    }

    try {
      const pages: InertiaPageInfo[] = [];

      // Check common Inertia page directories
      const pageDirs = [
        path.join(this.projectPath, "resources", "js", "Pages"),
        path.join(this.projectPath, "resources", "js", "pages"),
        path.join(this.projectPath, "resources", "ts", "Pages"),
        path.join(this.projectPath, "resources", "ts", "pages"),
      ];

      for (const dir of pageDirs) {
        if (fs.existsSync(dir)) {
          this.scanPagesDir(dir, dir, pages);
          break; // Use first found
        }
      }

      this.setPages(pages);
      this.cache.set("inertia", pages);
      this.connection.console.log(
        `[Inertia] Loaded ${pages.length} page components`
      );
    } catch (e) {
      this.connection.console.log(`[Inertia] Failed to load: ${e}`);
    }
  }

  async reload(): Promise<void> {
    this.cache.clear();
    await this.load();
  }

  findByName(name: string): InertiaPageInfo | undefined {
    return this.pagesByName.get(name);
  }

  search(query: string): InertiaPageInfo[] {
    if (!query) return this.pages;
    const lower = query.toLowerCase();
    return this.pages.filter((p) => p.name.toLowerCase().includes(lower));
  }

  getAll(): InertiaPageInfo[] {
    return this.pages;
  }

  count(): number {
    return this.pages.length;
  }

  private setPages(pages: InertiaPageInfo[]): void {
    this.pages = pages;
    this.pagesByName.clear();
    for (const page of pages) {
      this.pagesByName.set(page.name, page);
    }
  }

  private scanPagesDir(
    dir: string,
    baseDir: string,
    result: InertiaPageInfo[]
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
        this.scanPagesDir(fullPath, baseDir, result);
      } else if (this.isPageFile(entry.name)) {
        const relativePath = path.relative(baseDir, fullPath);
        // Page name: strip extension, use / as separator
        const pageName = relativePath
          .replace(/\.(vue|tsx?|jsx?|svelte)$/, "")
          .replace(/\\/g, "/");

        result.push({
          name: pageName,
          filePath: path.relative(this.projectPath, fullPath),
          absolutePath: fullPath,
          framework: this.detectFramework(entry.name),
        });
      }
    }
  }

  private isPageFile(filename: string): boolean {
    return /\.(vue|tsx?|jsx?|svelte)$/.test(filename);
  }

  private detectFramework(
    filename: string
  ): "vue" | "react" | "svelte" | "unknown" {
    if (filename.endsWith(".vue")) return "vue";
    if (filename.endsWith(".svelte")) return "svelte";
    if (/\.(tsx?|jsx?)$/.test(filename)) return "react";
    return "unknown";
  }
}
