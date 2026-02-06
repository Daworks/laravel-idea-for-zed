import { Connection } from "vscode-languageserver";
import { PhpRunner } from "../analyzer/php";
import { ConfigInfo } from "../types";
import { BoundedCache } from "../support/cache";

/**
 * Repository for collecting Laravel configuration keys.
 * Uses PHP to run config()->all() and flatten the config tree.
 */
export class ConfigRepository {
  private configs: ConfigInfo[] = [];
  private configsByKey: Map<string, ConfigInfo> = new Map();
  private cache: BoundedCache<ConfigInfo[]>;
  private loading = false;

  constructor(
    private php: PhpRunner,
    private connection: Connection
  ) {
    this.cache = new BoundedCache<ConfigInfo[]>(10, 10 * 60 * 1000);
  }

  async load(): Promise<void> {
    if (this.loading) return;

    const cached = this.cache.get("configs");
    if (cached) {
      this.setConfigs(cached);
      return;
    }

    this.loading = true;
    try {
      const phpCode = `
$flatten = function ($array, $prefix = '') use (&$flatten) {
    $result = [];
    foreach ($array as $key => $value) {
        $fullKey = $prefix ? $prefix . '.' . $key : $key;
        if (is_array($value) && !empty($value)) {
            $result[] = ['key' => $fullKey, 'value' => '[array]', 'hasChildren' => true];
            $result = array_merge($result, $flatten($value, $fullKey));
        } else {
            $display = $value;
            if (is_bool($value)) $display = $value ? 'true' : 'false';
            elseif (is_null($value)) $display = 'null';
            elseif (is_string($value) && strlen($value) > 100) $display = substr($value, 0, 100) . '...';
            $result[] = ['key' => $fullKey, 'value' => (string) $display, 'hasChildren' => false];
        }
    }
    return $result;
};

$configs = $flatten(config()->all());
echo json_encode($configs);
`;

      const output = await this.php.runInLaravel(phpCode);
      const rawConfigs: RawConfigData[] = JSON.parse(output);

      const configs: ConfigInfo[] = rawConfigs.map((c) => ({
        key: c.key,
        value: c.value,
        file: this.keyToFile(c.key),
        hasChildren: c.hasChildren,
      }));

      this.setConfigs(configs);
      this.cache.set("configs", configs);
      this.connection.console.log(
        `[Configs] Loaded ${configs.length} config keys`
      );
    } catch (e) {
      this.connection.console.log(`[Configs] Failed to load: ${e}`);
    } finally {
      this.loading = false;
    }
  }

  async reload(): Promise<void> {
    this.cache.clear();
    await this.load();
  }

  findByKey(key: string): ConfigInfo | undefined {
    return this.configsByKey.get(key);
  }

  search(query: string): ConfigInfo[] {
    if (!query) return this.configs;
    const lower = query.toLowerCase();
    return this.configs.filter((c) => c.key.toLowerCase().includes(lower));
  }

  /** Get direct children of a config prefix */
  getChildren(prefix: string): ConfigInfo[] {
    const dotPrefix = prefix ? prefix + "." : "";
    return this.configs.filter((c) => {
      if (!c.key.startsWith(dotPrefix)) return false;
      const remainder = c.key.substring(dotPrefix.length);
      return !remainder.includes(".");
    });
  }

  getAll(): ConfigInfo[] {
    return this.configs;
  }

  count(): number {
    return this.configs.length;
  }

  private setConfigs(configs: ConfigInfo[]): void {
    this.configs = configs;
    this.configsByKey.clear();
    for (const config of configs) {
      this.configsByKey.set(config.key, config);
    }
  }

  /** Derive config file path from key: "app.name" → "config/app.php" */
  private keyToFile(key: string): string {
    const topLevel = key.split(".")[0];
    return `config/${topLevel}.php`;
  }
}

interface RawConfigData {
  key: string;
  value: string;
  hasChildren: boolean;
}
