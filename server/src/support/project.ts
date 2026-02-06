import * as fs from "fs";
import * as path from "path";
import { ProjectInfo } from "../types";

/**
 * Detect if a workspace directory is a Laravel project.
 * Checks for key Laravel files and directories.
 */
export function detectLaravelProject(rootPath: string): ProjectInfo {
  const result: ProjectInfo = {
    rootPath,
    isLaravel: false,
  };

  if (!rootPath || !fs.existsSync(rootPath)) {
    return result;
  }

  // Primary check: bootstrap/app.php exists (most reliable indicator)
  const bootstrapApp = path.join(rootPath, "bootstrap", "app.php");
  if (!fs.existsSync(bootstrapApp)) {
    // Secondary check: artisan file + composer.json with laravel/framework
    const artisan = path.join(rootPath, "artisan");
    if (!fs.existsSync(artisan)) {
      return result;
    }
  }

  // Verify it's actually Laravel by checking composer.json
  const composerPath = path.join(rootPath, "composer.json");
  if (fs.existsSync(composerPath)) {
    try {
      const composer = JSON.parse(fs.readFileSync(composerPath, "utf-8"));
      const requires = { ...composer.require, ...composer["require-dev"] };
      if (requires["laravel/framework"]) {
        result.isLaravel = true;
      }
    } catch {
      // If composer.json is invalid, still try if bootstrap/app.php exists
      result.isLaravel = fs.existsSync(bootstrapApp);
    }
  }

  return result;
}
