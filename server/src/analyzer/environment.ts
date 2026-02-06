import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { PhpEnvironment } from "../types";

/**
 * Detect the PHP environment for a Laravel project.
 * Checks for Herd, Valet, Sail, and falls back to system PHP.
 */
export class EnvironmentDetector {
  constructor(private rootPath: string) {}

  async detect(): Promise<PhpEnvironment> {
    // Order: Herd > Valet > Sail > System
    const herd = this.detectHerd();
    if (herd) return herd;

    const valet = this.detectValet();
    if (valet) return valet;

    const sail = this.detectSail();
    if (sail) return sail;

    return this.detectSystem();
  }

  private detectHerd(): PhpEnvironment | null {
    // Laravel Herd (macOS) stores PHP in a known location
    const herdPaths = [
      path.join(process.env.HOME || "", "Library/Application Support/Herd/bin/php"),
      "/usr/local/bin/herd-php",
    ];

    for (const herdPath of herdPaths) {
      if (fs.existsSync(herdPath)) {
        const version = this.getPhpVersion(herdPath);
        return { phpPath: herdPath, type: "herd", version };
      }
    }

    // Also check if herd CLI is available
    try {
      const herdBin = this.which("herd");
      if (herdBin) {
        const phpPath = execFileSync(herdBin, ["which-php"], {
          encoding: "utf-8",
          timeout: 5000,
        }).trim();
        if (phpPath && fs.existsSync(phpPath)) {
          const version = this.getPhpVersion(phpPath);
          return { phpPath, type: "herd", version };
        }
      }
    } catch {
      // Herd not available
    }

    return null;
  }

  private detectValet(): PhpEnvironment | null {
    try {
      const valetBin = this.which("valet");
      if (!valetBin) return null;

      // Valet uses the system's linked PHP (via brew)
      const phpPath = this.which("php");
      if (phpPath) {
        const version = this.getPhpVersion(phpPath);
        return { phpPath, type: "valet", version };
      }
    } catch {
      // Valet not available
    }
    return null;
  }

  private detectSail(): PhpEnvironment | null {
    // Check for docker-compose.yml with Sail service
    const composePath = path.join(this.rootPath, "docker-compose.yml");
    if (!fs.existsSync(composePath)) return null;

    try {
      const content = fs.readFileSync(composePath, "utf-8");
      if (!content.includes("sail") && !content.includes("laravel.test")) {
        return null;
      }

      // Check if Docker is running
      execFileSync("docker", ["info"], { stdio: "ignore", timeout: 5000 });

      const sailPath = path.join(this.rootPath, "vendor/bin/sail");
      if (fs.existsSync(sailPath)) {
        return {
          phpPath: sailPath,
          type: "sail",
          version: undefined, // Will be detected at runtime
        };
      }
    } catch {
      // Docker not running or Sail not available
    }

    return null;
  }

  private detectSystem(): PhpEnvironment {
    const phpPath = this.which("php") || "php";
    const version = this.getPhpVersion(phpPath);
    return { phpPath, type: "system", version };
  }

  /** Safely locate a binary using `which` */
  private which(binary: string): string | null {
    try {
      return execFileSync("/usr/bin/which", [binary], {
        encoding: "utf-8",
        timeout: 3000,
      }).trim() || null;
    } catch {
      return null;
    }
  }

  private getPhpVersion(phpPath: string): string | undefined {
    try {
      const output = execFileSync(phpPath, ["-r", "echo PHP_VERSION;"], {
        encoding: "utf-8",
        timeout: 5000,
      });
      return output.trim();
    } catch {
      return undefined;
    }
  }
}
