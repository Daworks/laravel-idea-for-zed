import { Connection } from "vscode-languageserver";
import { PhpRunner } from "../analyzer/php";
import { BoundedCache } from "../support/cache";

export interface GateInfo {
  name: string;
  /** The class or closure that handles this gate */
  handler?: string;
}

export interface PolicyInfo {
  /** Model class name (short) */
  model: string;
  /** Policy class name */
  policyClass: string;
  /** Available ability methods */
  abilities: string[];
  /** File path relative to project */
  filePath?: string;
}

/**
 * Repository for Gates and Policies.
 * Collects gate definitions and policy-model mappings.
 */
export class GateRepository {
  private gates: GateInfo[] = [];
  private gatesByName: Map<string, GateInfo> = new Map();
  private policies: PolicyInfo[] = [];
  private policiesByModel: Map<string, PolicyInfo> = new Map();
  private cache: BoundedCache<{ gates: GateInfo[]; policies: PolicyInfo[] }>;

  constructor(
    private php: PhpRunner,
    private connection: Connection
  ) {
    this.cache = new BoundedCache(10, 10 * 60 * 1000);
  }

  async load(): Promise<void> {
    const cached = this.cache.get("gates");
    if (cached) {
      this.gates = cached.gates;
      this.policies = cached.policies;
      this.rebuildMaps();
      return;
    }

    try {
      const phpCode = `
$gate = app(\\Illuminate\\Contracts\\Auth\\Access\\Gate::class);
$reflection = new \\ReflectionClass($gate);

// Get defined gates
$gates = [];
$abilitiesProp = $reflection->getProperty('abilities');
$abilitiesProp->setAccessible(true);
$abilities = $abilitiesProp->getValue($gate);
foreach ($abilities as $name => $callback) {
    $gates[] = ['name' => $name, 'handler' => is_string($callback) ? $callback : 'Closure'];
}

// Get policies
$policies = [];
$policiesProp = $reflection->getProperty('policies');
$policiesProp->setAccessible(true);
$policyMap = $policiesProp->getValue($gate);

$projectPath = base_path();
foreach ($policyMap as $model => $policyClass) {
    $abilities = [];
    $filePath = null;
    try {
        $policyReflection = new \\ReflectionClass($policyClass);
        $filePath = $policyReflection->getFileName();
        if ($filePath && str_starts_with($filePath, $projectPath)) {
            $filePath = substr($filePath, strlen($projectPath) + 1);
        }
        foreach ($policyReflection->getMethods(\\ReflectionMethod::IS_PUBLIC) as $method) {
            if ($method->class !== $policyClass) continue;
            if (str_starts_with($method->getName(), '__')) continue;
            $abilities[] = $method->getName();
        }
    } catch (\\Throwable $e) {}

    $policies[] = [
        'model' => class_basename($model),
        'policyClass' => $policyClass,
        'abilities' => $abilities,
        'filePath' => $filePath,
    ];
}

echo json_encode(['gates' => $gates, 'policies' => $policies]);
`;

      const output = await this.php.runInLaravel(phpCode);
      const data = JSON.parse(output);

      this.gates = data.gates ?? [];
      this.policies = data.policies ?? [];
      this.rebuildMaps();
      this.cache.set("gates", { gates: this.gates, policies: this.policies });
      this.connection.console.log(
        `[Gates] Loaded ${this.gates.length} gates, ${this.policies.length} policies`
      );
    } catch (e) {
      this.connection.console.log(`[Gates] Failed to load: ${e}`);
    }
  }

  async reload(): Promise<void> {
    this.cache.clear();
    await this.load();
  }

  searchGates(query: string): GateInfo[] {
    if (!query) return this.gates;
    const lower = query.toLowerCase();
    return this.gates.filter((g) => g.name.toLowerCase().includes(lower));
  }

  searchPolicies(query: string): PolicyInfo[] {
    if (!query) return this.policies;
    const lower = query.toLowerCase();
    return this.policies.filter((p) =>
      p.model.toLowerCase().includes(lower) ||
      p.abilities.some((a) => a.toLowerCase().includes(lower))
    );
  }

  findGate(name: string): GateInfo | undefined {
    return this.gatesByName.get(name);
  }

  findPolicyByModel(model: string): PolicyInfo | undefined {
    return this.policiesByModel.get(model);
  }

  /** Get all gate and policy ability names for completions */
  getAllAbilityNames(): string[] {
    const names = new Set<string>();
    for (const gate of this.gates) {
      names.add(gate.name);
    }
    for (const policy of this.policies) {
      for (const ability of policy.abilities) {
        names.add(ability);
      }
    }
    return Array.from(names);
  }

  gateCount(): number {
    return this.gates.length;
  }

  policyCount(): number {
    return this.policies.length;
  }

  private rebuildMaps(): void {
    this.gatesByName.clear();
    this.policiesByModel.clear();
    for (const g of this.gates) {
      this.gatesByName.set(g.name, g);
    }
    for (const p of this.policies) {
      this.policiesByModel.set(p.model, p);
    }
  }
}
