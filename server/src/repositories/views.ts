import { Connection } from "vscode-languageserver";
import * as fs from "fs";
import * as path from "path";
import { ViewInfo } from "../types";
import { BoundedCache } from "../support/cache";

/**
 * Repository for collecting Laravel view files.
 * Scans resources/views directory to build the view name registry.
 * View names follow dot notation: "auth.login" → resources/views/auth/login.blade.php
 */
export class ViewRepository {
  private views: ViewInfo[] = [];
  private viewsByName: Map<string, ViewInfo> = new Map();
  private cache: BoundedCache<ViewInfo[]>;

  constructor(
    private projectPath: string,
    private connection: Connection
  ) {
    this.cache = new BoundedCache<ViewInfo[]>(10, 10 * 60 * 1000);
  }

  async load(): Promise<void> {
    const cached = this.cache.get("views");
    if (cached) {
      this.setViews(cached);
      return;
    }

    try {
      const viewsPath = path.join(this.projectPath, "resources", "views");
      if (!fs.existsSync(viewsPath)) {
        this.connection.console.log(`[Views] No views directory found`);
        return;
      }

      const views = this.scanViewDirectory(viewsPath, viewsPath);

      // Also scan vendor views (published packages)
      const vendorViewsPath = path.join(viewsPath, "vendor");
      if (fs.existsSync(vendorViewsPath)) {
        const vendorDirs = fs.readdirSync(vendorViewsPath, { withFileTypes: true });
        for (const dir of vendorDirs) {
          if (dir.isDirectory()) {
            const packageViews = this.scanViewDirectory(
              path.join(vendorViewsPath, dir.name),
              path.join(vendorViewsPath, dir.name)
            );
            // Vendor views use namespace: "vendor::view.name"
            for (const view of packageViews) {
              view.name = `${dir.name}::${view.name}`;
              views.push(view);
            }
          }
        }
      }

      this.setViews(views);
      this.cache.set("views", views);
      this.connection.console.log(`[Views] Loaded ${views.length} views`);
    } catch (e) {
      this.connection.console.log(`[Views] Failed to load: ${e}`);
    }
  }

  async reload(): Promise<void> {
    this.cache.clear();
    await this.load();
  }

  findByName(name: string): ViewInfo | undefined {
    return this.viewsByName.get(name);
  }

  search(query: string): ViewInfo[] {
    if (!query) return this.views;
    const lower = query.toLowerCase();
    return this.views.filter((v) => v.name.toLowerCase().includes(lower));
  }

  getAll(): ViewInfo[] {
    return this.views;
  }

  count(): number {
    return this.views.length;
  }

  private setViews(views: ViewInfo[]): void {
    this.views = views;
    this.viewsByName.clear();
    for (const view of views) {
      this.viewsByName.set(view.name, view);
    }
  }

  /**
   * Recursively scan a directory for blade template files.
   * Converts file paths to dot notation view names.
   */
  private scanViewDirectory(dir: string, baseDir: string): ViewInfo[] {
    const views: ViewInfo[] = [];

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return views;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip vendor directory (handled separately)
        if (entry.name === "vendor" && dir === baseDir) continue;
        views.push(...this.scanViewDirectory(fullPath, baseDir));
      } else if (entry.name.endsWith(".blade.php")) {
        // Convert path to view name: auth/login.blade.php → auth.login
        const relativePath = path.relative(baseDir, fullPath);
        const viewName = relativePath
          .replace(/\.blade\.php$/, "")
          .replace(/\//g, ".")
          .replace(/\\/g, "."); // Windows support

        views.push({
          name: viewName,
          relativePath,
          absolutePath: fullPath,
        });
      }
    }

    return views;
  }
}
