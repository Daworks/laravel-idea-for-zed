import { Connection } from "vscode-languageserver";
import { PhpRunner } from "../analyzer/php";
import { MiddlewareInfo } from "../types";
import { BoundedCache } from "../support/cache";

/**
 * Repository for collecting Laravel middleware.
 * Uses PHP to query registered middleware aliases and groups.
 */
export class MiddlewareRepository {
  private middleware: MiddlewareInfo[] = [];
  private middlewareByName: Map<string, MiddlewareInfo> = new Map();
  private cache: BoundedCache<MiddlewareInfo[]>;
  private loading = false;

  constructor(
    private php: PhpRunner,
    private connection: Connection
  ) {
    this.cache = new BoundedCache<MiddlewareInfo[]>(10, 10 * 60 * 1000);
  }

  async load(): Promise<void> {
    if (this.loading) return;

    const cached = this.cache.get("middleware");
    if (cached) {
      this.setMiddleware(cached);
      return;
    }

    this.loading = true;
    try {
      const phpCode = `
$router = app('router');
$result = [];

// Get middleware aliases
$aliases = [];
if (method_exists($router, 'getMiddleware')) {
    $aliases = $router->getMiddleware();
} elseif (property_exists($router, 'middleware')) {
    $ref = new \\ReflectionProperty($router, 'middleware');
    $ref->setAccessible(true);
    $aliases = $ref->getValue($router);
}

foreach ($aliases as $name => $class) {
    $filePath = null;
    try {
        $ref = new \\ReflectionClass($class);
        $filePath = $ref->getFileName();
    } catch (\\Throwable $e) {}

    $result[] = [
        'name' => $name,
        'class' => is_string($class) ? $class : get_class($class),
        'filePath' => $filePath,
        'type' => 'alias',
    ];
}

// Get middleware groups
$groups = [];
if (method_exists($router, 'getMiddlewareGroups')) {
    $groups = $router->getMiddlewareGroups();
}

foreach ($groups as $name => $middlewares) {
    $result[] = [
        'name' => $name,
        'class' => implode(', ', array_map(fn($m) => is_string($m) ? $m : get_class($m), $middlewares)),
        'filePath' => null,
        'type' => 'group',
    ];
}

echo json_encode($result);
`;

      const output = await this.php.runInLaravel(phpCode);
      const rawMiddleware: RawMiddlewareData[] = JSON.parse(output);

      const middleware: MiddlewareInfo[] = rawMiddleware.map((m) => ({
        name: m.name,
        class: m.class,
        filePath: m.filePath || undefined,
      }));

      this.setMiddleware(middleware);
      this.cache.set("middleware", middleware);
      this.connection.console.log(
        `[Middleware] Loaded ${middleware.length} middleware`
      );
    } catch (e) {
      this.connection.console.log(`[Middleware] Failed to load: ${e}`);
    } finally {
      this.loading = false;
    }
  }

  async reload(): Promise<void> {
    this.cache.clear();
    await this.load();
  }

  findByName(name: string): MiddlewareInfo | undefined {
    return this.middlewareByName.get(name);
  }

  search(query: string): MiddlewareInfo[] {
    if (!query) return this.middleware;
    const lower = query.toLowerCase();
    return this.middleware.filter((m) =>
      m.name.toLowerCase().includes(lower)
    );
  }

  getAll(): MiddlewareInfo[] {
    return this.middleware;
  }

  count(): number {
    return this.middleware.length;
  }

  private setMiddleware(middleware: MiddlewareInfo[]): void {
    this.middleware = middleware;
    this.middlewareByName.clear();
    for (const m of middleware) {
      this.middlewareByName.set(m.name, m);
    }
  }
}

interface RawMiddlewareData {
  name: string;
  class: string;
  filePath: string | null;
  type: string;
}
