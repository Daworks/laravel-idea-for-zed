import { Connection } from "vscode-languageserver";
import { PhpRunner } from "../analyzer/php";
import { RouteInfo } from "../types";
import { BoundedCache } from "../support/cache";

/**
 * Repository for collecting and caching Laravel route data.
 * Based on the approach from laravel/vs-code-extension:
 * Uses Reflection to resolve both route info and file locations in one pass.
 */
export class RouteRepository {
  private routes: RouteInfo[] = [];
  private routesByName: Map<string, RouteInfo> = new Map();
  private cache: BoundedCache<RouteInfo[]>;
  private loading = false;

  constructor(
    private php: PhpRunner,
    private connection: Connection
  ) {
    this.cache = new BoundedCache<RouteInfo[]>(10, 10 * 60 * 1000); // 10 min TTL
  }

  /** Load all routes from the Laravel application */
  async load(): Promise<void> {
    if (this.loading) return;

    const cached = this.cache.get("routes");
    if (cached) {
      this.setRoutes(cached);
      return;
    }

    this.loading = true;
    try {
      // PHP template inspired by laravel/vs-code-extension's routes template.
      // Uses Reflection to resolve file paths and line numbers in one pass.
      const phpCode = `
$projectPath = base_path();

$getReflection = function ($route) {
    try {
        if ($route->getActionName() === 'Closure') {
            return new \\ReflectionFunction($route->getAction()['uses']);
        }
        if (!str_contains($route->getActionName(), '@')) {
            return new \\ReflectionClass($route->getActionName());
        }
        return new \\ReflectionMethod($route->getControllerClass(), $route->getActionMethod());
    } catch (\\Throwable $e) {
        return null;
    }
};

$routes = collect(app('router')->getRoutes()->getRoutes())
    ->map(function ($route) use ($getReflection, $projectPath) {
        $reflection = $getReflection($route);

        $methods = collect($route->methods())
            ->filter(fn($m) => $m !== 'HEAD')
            ->values()
            ->toArray();

        $filename = null;
        $line = null;
        if ($reflection) {
            $filename = $reflection->getFileName();
            $line = $reflection->getStartLine();
            if ($filename && str_starts_with($filename, $projectPath)) {
                $filename = substr($filename, strlen($projectPath) + 1);
            }
        }

        return [
            'name' => $route->getName(),
            'uri' => $route->uri(),
            'methods' => $methods,
            'action' => $route->getActionName(),
            'parameters' => $route->parameterNames(),
            'middleware' => array_values((array) ($route->middleware() ?? [])),
            'filename' => $filename,
            'line' => $line,
        ];
    })
    ->filter(fn($r) => $r['name'] !== null)
    ->values()
    ->toArray();

echo json_encode($routes);
`;

      // runInLaravel now handles delimiter extraction and error detection
      const output = await this.php.runInLaravel(phpCode);

      const rawRoutes: RawRouteData[] = JSON.parse(output);
      const routes = rawRoutes.map((r) => this.toRouteInfo(r));

      this.setRoutes(routes);
      this.cache.set("routes", routes);
      this.connection.console.log(
        `[Routes] Loaded ${routes.length} named routes`
      );
    } catch (e) {
      this.connection.console.log(`[Routes] Failed to load routes: ${e}`);
    } finally {
      this.loading = false;
    }
  }

  /** Reload routes (e.g., after file change) */
  async reload(): Promise<void> {
    this.cache.clear();
    await this.load();
  }

  /** Find a route by name */
  findByName(name: string): RouteInfo | undefined {
    return this.routesByName.get(name);
  }

  /** Get all routes, optionally filtered by prefix */
  getAll(prefix?: string): RouteInfo[] {
    if (!prefix) return this.routes;
    return this.routes.filter((r) => r.name.startsWith(prefix));
  }

  /** Get the number of loaded routes */
  count(): number {
    return this.routes.length;
  }

  /** Search routes by name (fuzzy) */
  search(query: string): RouteInfo[] {
    if (!query) return this.routes;
    const lower = query.toLowerCase();
    return this.routes.filter((r) => r.name.toLowerCase().includes(lower));
  }

  private setRoutes(routes: RouteInfo[]): void {
    this.routes = routes;
    this.routesByName.clear();
    for (const route of routes) {
      if (route.name) {
        this.routesByName.set(route.name, route);
      }
    }
  }

  /** Convert raw PHP data to RouteInfo */
  private toRouteInfo(raw: RawRouteData): RouteInfo {
    // Parse controller and method from action string like "App\Http\Controllers\UserController@index"
    let controller: string | undefined;
    let controllerMethod: string | undefined;

    if (raw.action && raw.action !== "Closure" && raw.action.includes("@")) {
      const parts = raw.action.split("@");
      controller = parts[0];
      controllerMethod = parts[1];
    } else if (raw.action && raw.action !== "Closure" && !raw.action.includes("@")) {
      // __invoke controller
      controller = raw.action;
      controllerMethod = "__invoke";
    }

    return {
      name: raw.name,
      uri: raw.uri,
      methods: raw.methods,
      action: raw.action,
      controller,
      controllerMethod,
      controllerFilePath: raw.filename || undefined,
      controllerFileLine: raw.line || undefined,
      middleware: raw.middleware,
      parameters: raw.parameters,
    };
  }
}

/** Raw route data from PHP execution */
interface RawRouteData {
  name: string;
  uri: string;
  methods: string[];
  action: string;
  parameters: string[];
  middleware: string[];
  filename: string | null;
  line: number | null;
}
