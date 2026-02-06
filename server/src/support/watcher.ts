import * as fs from "fs";
import * as path from "path";

type ChangeCallback = (filePath: string) => void;

/**
 * Watch for file changes in a Laravel project.
 * Monitors route files, config files, views, etc. for changes
 * and triggers re-indexing of affected repositories.
 */
export class FileWatcher {
  private watchers: fs.FSWatcher[] = [];

  constructor(private rootPath: string) {}

  /**
   * Watch specific directories/patterns and call back on changes.
   */
  watchPaths(
    relativePaths: string[],
    callback: ChangeCallback
  ): void {
    for (const rel of relativePaths) {
      const absPath = path.join(this.rootPath, rel);
      if (!fs.existsSync(absPath)) continue;

      try {
        const watcher = fs.watch(
          absPath,
          { recursive: true },
          (_event, filename) => {
            if (filename) {
              callback(path.join(absPath, filename));
            }
          }
        );

        this.watchers.push(watcher);
      } catch {
        // Silently skip paths that can't be watched
      }
    }
  }

  /** Watch route-related files */
  watchRoutes(callback: ChangeCallback): void {
    this.watchPaths(["routes"], callback);
  }

  /** Watch view files */
  watchViews(callback: ChangeCallback): void {
    this.watchPaths(["resources/views"], callback);
  }

  /** Watch config files */
  watchConfigs(callback: ChangeCallback): void {
    this.watchPaths(["config"], callback);
  }

  /** Watch translation files */
  watchTranslations(callback: ChangeCallback): void {
    this.watchPaths(["lang", "resources/lang"], callback);
  }

  /** Stop all watchers */
  dispose(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
  }
}
