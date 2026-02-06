import { execFile } from "child_process";
import * as path from "path";
import { PhpEnvironment } from "../types";

/** Output delimiters for extracting structured data from PHP stdout */
const OUTPUT_START = "___LARAVEL_LS_START___";
const OUTPUT_END = "___LARAVEL_LS_END___";
const ERROR_MARKER = "___LARAVEL_LS_ERROR___";

/**
 * Execute PHP code within a Laravel application context.
 * This is the core infrastructure for querying Laravel runtime data
 * (routes, config, models, etc.)
 */
export class PhpRunner {
  constructor(
    private env: PhpEnvironment,
    private projectPath: string
  ) {}

  /**
   * Run arbitrary PHP code inside the Laravel application.
   * Bootstraps the Laravel app, runs the code, and returns only
   * the output between start/end delimiters (ignoring PHP warnings).
   */
  async runInLaravel(code: string): Promise<string> {
    const bootstrapCode = this.buildBootstrapCode(code);
    const raw = await this.runPhp(bootstrapCode);
    return PhpRunner.extractOutput(raw);
  }

  /**
   * Run a raw PHP expression and return the output.
   */
  async runPhp(code: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = this.buildPhpArgs(code);

      const options = {
        cwd: this.projectPath,
        timeout: 15000,
        maxBuffer: 2 * 1024 * 1024, // 2MB
        env: { ...process.env, LARAVEL_LS: "1" },
      };

      if (this.env.type === "sail") {
        execFile(
          this.env.phpPath,
          ["php", ...args],
          options,
          (error, stdout, stderr) => {
            if (error) {
              reject(new Error(`PHP execution failed: ${stderr || error.message}`));
              return;
            }
            resolve(stdout);
          }
        );
      } else {
        execFile(this.env.phpPath, args, options, (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`PHP execution failed: ${stderr || error.message}`));
            return;
          }
          resolve(stdout);
        });
      }
    });
  }

  /**
   * Run an artisan command and return the output.
   */
  async artisan(command: string, args: string[] = []): Promise<string> {
    return new Promise((resolve, reject) => {
      let execCommand: string;
      let execArgs: string[];

      if (this.env.type === "sail") {
        // Sail: use `sail artisan <command>` (not `sail php artisan`)
        execCommand = this.env.phpPath;
        execArgs = ["artisan", command, ...args];
      } else {
        execCommand = this.env.phpPath;
        execArgs = [path.join(this.projectPath, "artisan"), command, ...args];
      }

      execFile(
        execCommand,
        execArgs,
        {
          cwd: this.projectPath,
          timeout: 15000,
          maxBuffer: 2 * 1024 * 1024,
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`Artisan failed: ${stderr || error.message}`));
            return;
          }
          resolve(stdout);
        }
      );
    });
  }

  private buildPhpArgs(code: string): string[] {
    return ["-r", code];
  }

  /**
   * Wrap user code with Laravel bootstrap.
   * - Suppresses display_errors to prevent PHP warnings from corrupting output
   * - Uses output delimiters to safely extract JSON from stdout
   * - Escapes project path to prevent PHP injection via path names
   */
  private buildBootstrapCode(code: string): string {
    const escapedPath = this.projectPath.replace(/'/g, "\\'");
    return `
error_reporting(0);
ini_set('display_errors', '0');

define('LARAVEL_START', microtime(true));

require_once '${escapedPath}/vendor/autoload.php';

$app = require_once '${escapedPath}/bootstrap/app.php';

$app->register(new class($app) extends \\Illuminate\\Support\\ServiceProvider {
    public function boot() {
        config(['logging.channels.null' => ['driver' => 'monolog', 'handler' => \\Monolog\\Handler\\NullHandler::class], 'logging.default' => 'null']);
    }
});

$kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class);
$kernel->bootstrap();

echo '${OUTPUT_START}';
try {
    ${code}
} catch (\\Throwable $e) {
    echo '${ERROR_MARKER}' . $e->getMessage();
}
echo '${OUTPUT_END}';
`.trim();
  }

  /**
   * Extract the structured output from between delimiters.
   * Ignores any PHP warnings/notices that appear before or after.
   */
  static extractOutput(raw: string): string {
    const startIdx = raw.indexOf(OUTPUT_START);
    const endIdx = raw.indexOf(OUTPUT_END);

    if (startIdx === -1 || endIdx === -1) {
      // No delimiters found -- return raw output as fallback
      return raw;
    }

    const content = raw.substring(startIdx + OUTPUT_START.length, endIdx);

    if (content.includes(ERROR_MARKER)) {
      const errorMsg = content.split(ERROR_MARKER)[1];
      throw new Error(`Laravel error: ${errorMsg}`);
    }

    return content;
  }
}
