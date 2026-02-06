import {
  createConnection,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocuments,
  CompletionParams,
  CompletionItem,
  DefinitionParams,
  Definition,
  HoverParams,
  Hover,
  DidChangeWatchedFilesParams,
  CodeActionParams,
  CodeAction,
  MarkupKind,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";
import { getServerCapabilities } from "./capabilities";
import { ProjectInfo, FunctionCallContext } from "./types";
import { detectLaravelProject } from "./support/project";
import { PhpRunner } from "./analyzer/php";
import { EnvironmentDetector } from "./analyzer/environment";
import { ContextParser } from "./analyzer/parser";
import { FileWatcher } from "./support/watcher";

// Repositories
import { RouteRepository } from "./repositories/routes";
import { ViewRepository } from "./repositories/views";
import { ConfigRepository } from "./repositories/configs";
import { TranslationRepository } from "./repositories/translations";
import { EnvRepository } from "./repositories/env";
import { MiddlewareRepository } from "./repositories/middleware";
import { ModelRepository } from "./repositories/models";
import { ValidationRepository } from "./repositories/validation";
import { BladeComponentRepository } from "./repositories/blade-components";
import { LivewireRepository } from "./repositories/livewire";
import { InertiaRepository } from "./repositories/inertia";
import { GateRepository } from "./repositories/gates";

// Completion providers
import { RouteCompletionProvider } from "./features/completion/routes";
import { ViewCompletionProvider } from "./features/completion/views";
import { ConfigCompletionProvider } from "./features/completion/configs";
import { TranslationCompletionProvider } from "./features/completion/translations";
import { EnvCompletionProvider } from "./features/completion/env";
import { MiddlewareCompletionProvider } from "./features/completion/middleware";
import { EloquentCompletionProvider } from "./features/completion/eloquent";
import { ValidationCompletionProvider } from "./features/completion/validation";
import { BladeCompletionProvider } from "./features/completion/blade";
import { LivewireCompletionProvider } from "./features/completion/livewire";
import { InertiaCompletionProvider } from "./features/completion/inertia";
import { GateCompletionProvider } from "./features/completion/gates";

// Definition providers
import { RouteDefinitionProvider } from "./features/definition/routes";
import { ViewDefinitionProvider } from "./features/definition/views";
import { ConfigDefinitionProvider } from "./features/definition/configs";
import { TranslationDefinitionProvider } from "./features/definition/translations";
import { EloquentDefinitionProvider } from "./features/definition/eloquent";
import { BladeDefinitionProvider } from "./features/definition/blade";
import { LivewireDefinitionProvider } from "./features/definition/livewire";
import { InertiaDefinitionProvider } from "./features/definition/inertia";

// Diagnostic & CodeAction
import { LaravelDiagnosticProvider } from "./features/diagnostic/laravel";
import { MissingItemsCodeActionProvider } from "./features/codeAction/missingItems";

// Create LSP connection over stdio
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

// State
let projectInfo: ProjectInfo | undefined;
let contextParser: ContextParser | undefined;
let fileWatcher: FileWatcher | undefined;

// Repositories
let routeRepo: RouteRepository | undefined;
let viewRepo: ViewRepository | undefined;
let configRepo: ConfigRepository | undefined;
let translationRepo: TranslationRepository | undefined;
let envRepo: EnvRepository | undefined;
let middlewareRepo: MiddlewareRepository | undefined;
let modelRepo: ModelRepository | undefined;
let validationRepo: ValidationRepository | undefined;
let bladeComponentRepo: BladeComponentRepository | undefined;
let livewireRepo: LivewireRepository | undefined;
let inertiaRepo: InertiaRepository | undefined;
let gateRepo: GateRepository | undefined;

// Completion providers
let routeCompletion: RouteCompletionProvider | undefined;
let viewCompletion: ViewCompletionProvider | undefined;
let configCompletion: ConfigCompletionProvider | undefined;
let translationCompletion: TranslationCompletionProvider | undefined;
let envCompletion: EnvCompletionProvider | undefined;
let middlewareCompletion: MiddlewareCompletionProvider | undefined;
let eloquentCompletion: EloquentCompletionProvider | undefined;
let validationCompletion: ValidationCompletionProvider | undefined;
let bladeCompletion: BladeCompletionProvider | undefined;
let livewireCompletion: LivewireCompletionProvider | undefined;
let inertiaCompletion: InertiaCompletionProvider | undefined;
let gateCompletion: GateCompletionProvider | undefined;

// Definition providers
let routeDefinition: RouteDefinitionProvider | undefined;
let viewDefinition: ViewDefinitionProvider | undefined;
let configDefinition: ConfigDefinitionProvider | undefined;
let translationDefinition: TranslationDefinitionProvider | undefined;
let eloquentDefinition: EloquentDefinitionProvider | undefined;
let bladeDefinition: BladeDefinitionProvider | undefined;
let livewireDefinition: LivewireDefinitionProvider | undefined;
let inertiaDefinition: InertiaDefinitionProvider | undefined;

// Diagnostic & CodeAction
let diagnosticProvider: LaravelDiagnosticProvider | undefined;
let codeActionProvider: MissingItemsCodeActionProvider | undefined;

// ─── Function name → provider category mapping ───────────────────────

const ROUTE_FUNCTIONS = new Set([
  "route", "to_route", "signedRoute", "temporarySignedRoute",
]);

const VIEW_FUNCTIONS = new Set([
  "view", "make", "renderWhen", "renderUnless",
  "include", "includeIf", "includeWhen", "includeUnless", "includeFirst",
  "extends", "component", "each",
]);

const CONFIG_FUNCTIONS = new Set([
  "config",
]);

const TRANSLATION_FUNCTIONS = new Set([
  "__", "trans", "trans_choice", "lang",
]);

const ENV_FUNCTIONS = new Set(["env"]);

const MIDDLEWARE_FUNCTIONS = new Set(["middleware"]);

const ELOQUENT_QUERY_FUNCTIONS = new Set([
  "where", "orWhere", "whereIn", "whereNotIn",
  "whereBetween", "whereNotBetween", "whereNull", "whereNotNull",
  "orderBy", "orderByDesc", "groupBy",
  "select", "addSelect",
  "pluck", "value",
  "firstWhere",
]);

const ELOQUENT_MASS_FUNCTIONS = new Set([
  "create", "forceCreate", "fill", "forceFill", "update", "updateOrCreate",
  "firstOrCreate", "firstOrNew",
]);

const RELATION_FUNCTIONS = new Set([
  "with", "without", "load", "loadMissing",
  "has", "orHas", "doesntHave", "orDoesntHave",
  "whereHas", "orWhereHas", "whereDoesntHave",
  "withCount", "withSum", "withAvg", "withMin", "withMax",
]);

const VALIDATION_FUNCTIONS = new Set(["validate", "sometimes"]);

const GATE_FUNCTIONS = new Set([
  "can", "cannot", "allows", "denies", "authorize",
]);

const LIVEWIRE_FUNCTIONS = new Set(["livewire"]);

const INERTIA_FUNCTIONS = new Set(["render"]);

function getProviderCategory(
  functionName: string,
  className?: string
): string | null {
  // Check specific class context first
  if (className) {
    const cls = className.toLowerCase();
    if (cls === "view" || cls === "blade") return "view";
    if (cls === "config") return "config";
    if (cls === "route" || cls === "url" || cls === "redirect") return "route";
    if (cls === "lang" || cls === "translator") return "translation";
    if (cls === "gate") return "gate";
    if (cls === "inertia") return "inertia";
    if (cls === "livewire") return "livewire";
    if (cls === "validator") return "validation";
  }

  // Specific function matches
  if (ROUTE_FUNCTIONS.has(functionName)) return "route";
  if (TRANSLATION_FUNCTIONS.has(functionName)) return "translation";
  if (ENV_FUNCTIONS.has(functionName)) return "env";
  if (MIDDLEWARE_FUNCTIONS.has(functionName)) return "middleware";
  if (GATE_FUNCTIONS.has(functionName)) return "gate";
  if (LIVEWIRE_FUNCTIONS.has(functionName)) return "livewire";
  if (VALIDATION_FUNCTIONS.has(functionName)) return "validation";

  // Eloquent query methods
  if (ELOQUENT_QUERY_FUNCTIONS.has(functionName)) return "eloquent_column";
  if (ELOQUENT_MASS_FUNCTIONS.has(functionName)) return "eloquent_column";
  if (RELATION_FUNCTIONS.has(functionName)) return "eloquent_relation";

  // Ambiguous names
  if (functionName === "view") return "view";
  if (functionName === "config") return "config";

  // Blade directives and view helpers
  if (VIEW_FUNCTIONS.has(functionName)) return "view";

  return null;
}

// ─── LSP Lifecycle ───────────────────────────────────────────────────

connection.onInitialize((params: InitializeParams): InitializeResult => {
  const workspaceFolderUri = params.workspaceFolders?.[0]?.uri;
  const workspacePath =
    params.initializationOptions?.workspacePath ||
    (workspaceFolderUri ? URI.parse(workspaceFolderUri).fsPath : "") ||
    "";

  connection.console.log(
    `[Laravel LS] Initializing for workspace: ${workspacePath}`
  );

  projectInfo = detectLaravelProject(workspacePath);

  if (!projectInfo.isLaravel) {
    connection.console.log(
      `[Laravel LS] Not a Laravel project, features will be limited`
    );
  }

  return {
    capabilities: getServerCapabilities(),
    serverInfo: {
      name: "Laravel Language Server",
      version: "1.0.0",
    },
  };
});

connection.onInitialized(async () => {
  if (!projectInfo?.isLaravel) return;

  connection.console.log(`[Laravel LS] Setting up Laravel features...`);

  try {
    // Detect PHP environment
    const envDetector = new EnvironmentDetector(projectInfo.rootPath);
    const phpEnv = await envDetector.detect();
    projectInfo.phpEnvironment = phpEnv;
    connection.console.log(
      `[Laravel LS] PHP environment: ${phpEnv.type} (${phpEnv.phpPath})`
    );

    const phpRunner = new PhpRunner(phpEnv, projectInfo.rootPath);

    // Detect Laravel version
    try {
      const version = await phpRunner.runInLaravel(`echo app()->version();`);
      projectInfo.laravelVersion = version.trim();
      connection.console.log(
        `[Laravel LS] Laravel version: ${projectInfo.laravelVersion}`
      );
    } catch {
      connection.console.log(`[Laravel LS] Could not detect Laravel version`);
    }

    // Initialize context parser
    contextParser = new ContextParser();

    // Initialize repositories - PHP-dependent
    routeRepo = new RouteRepository(phpRunner, connection);
    configRepo = new ConfigRepository(phpRunner, connection);
    middlewareRepo = new MiddlewareRepository(phpRunner, connection);
    modelRepo = new ModelRepository(phpRunner, connection);
    validationRepo = new ValidationRepository(phpRunner, connection);
    gateRepo = new GateRepository(phpRunner, connection);

    // File-system-based repos
    viewRepo = new ViewRepository(projectInfo.rootPath, connection);
    translationRepo = new TranslationRepository(projectInfo.rootPath, connection);
    envRepo = new EnvRepository(projectInfo.rootPath, connection);
    bladeComponentRepo = new BladeComponentRepository(projectInfo.rootPath, connection);
    livewireRepo = new LivewireRepository(projectInfo.rootPath, connection);
    inertiaRepo = new InertiaRepository(projectInfo.rootPath, connection);

    // Load all repositories concurrently
    await Promise.allSettled([
      routeRepo.load(),
      viewRepo.load(),
      configRepo.load(),
      translationRepo.load(),
      envRepo.load(),
      middlewareRepo.load(),
      modelRepo.load(),
      validationRepo.load(),
      bladeComponentRepo.load(),
      livewireRepo.load(),
      inertiaRepo.load(),
      gateRepo.load(),
    ]);

    // Initialize completion providers
    routeCompletion = new RouteCompletionProvider(routeRepo);
    viewCompletion = new ViewCompletionProvider(viewRepo);
    configCompletion = new ConfigCompletionProvider(configRepo);
    translationCompletion = new TranslationCompletionProvider(translationRepo);
    envCompletion = new EnvCompletionProvider(envRepo);
    middlewareCompletion = new MiddlewareCompletionProvider(middlewareRepo);
    eloquentCompletion = new EloquentCompletionProvider(modelRepo);
    validationCompletion = new ValidationCompletionProvider(validationRepo);
    bladeCompletion = new BladeCompletionProvider(bladeComponentRepo);
    livewireCompletion = new LivewireCompletionProvider(livewireRepo);
    inertiaCompletion = new InertiaCompletionProvider(inertiaRepo);
    gateCompletion = new GateCompletionProvider(gateRepo);

    // Initialize definition providers
    routeDefinition = new RouteDefinitionProvider(routeRepo, projectInfo.rootPath);
    viewDefinition = new ViewDefinitionProvider(viewRepo);
    configDefinition = new ConfigDefinitionProvider(configRepo, projectInfo.rootPath);
    translationDefinition = new TranslationDefinitionProvider(translationRepo);
    eloquentDefinition = new EloquentDefinitionProvider(modelRepo, projectInfo.rootPath);
    bladeDefinition = new BladeDefinitionProvider(bladeComponentRepo);
    livewireDefinition = new LivewireDefinitionProvider(livewireRepo);
    inertiaDefinition = new InertiaDefinitionProvider(inertiaRepo);

    // Initialize diagnostic & code action providers
    diagnosticProvider = new LaravelDiagnosticProvider(routeRepo, viewRepo, configRepo);
    codeActionProvider = new MissingItemsCodeActionProvider();

    // Watch files for changes
    fileWatcher = new FileWatcher(projectInfo.rootPath);
    fileWatcher.watchRoutes(() => routeRepo?.reload());
    fileWatcher.watchViews(() => {
      viewRepo?.reload();
      bladeComponentRepo?.reload();
    });
    fileWatcher.watchConfigs(() => configRepo?.reload());
    fileWatcher.watchTranslations(() => translationRepo?.reload());

    const counts = [
      `${routeRepo.count()} routes`,
      `${viewRepo.count()} views`,
      `${configRepo.count()} configs`,
      `${translationRepo.count()} translations`,
      `${envRepo.count()} env vars`,
      `${middlewareRepo.count()} middleware`,
      `${modelRepo.count()} models`,
      `${validationRepo.count()} validation rules`,
      `${bladeComponentRepo.count()} blade components`,
      `${livewireRepo.count()} livewire`,
      `${inertiaRepo.count()} inertia pages`,
      `${gateRepo.gateCount()} gates`,
      `${gateRepo.policyCount()} policies`,
    ].join(", ");

    connection.console.log(`[Laravel LS] Ready! Loaded: ${counts}`);
  } catch (e) {
    connection.console.log(`[Laravel LS] Error during initialization: ${e}`);
  }
});

// ─── Completion ──────────────────────────────────────────────────────

connection.onCompletion(
  async (params: CompletionParams): Promise<CompletionItem[]> => {
    if (!contextParser || !projectInfo?.isLaravel) return [];

    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    // Check for Blade directive completion (@...)
    const lineText = document.getText({
      start: { line: params.position.line, character: 0 },
      end: params.position,
    });

    if (lineText.match(/@(\w*)$/) && bladeCompletion) {
      const directivePrefix = lineText.match(/@(\w*)$/)?.[1] ?? "";
      return bladeCompletion.provideDirectiveCompletions(directivePrefix);
    }

    // Check for Blade component completion (<x-...)
    const componentMatch = lineText.match(/<x-([\w.-]*)$/);
    if (componentMatch && bladeCompletion) {
      return bladeCompletion.provideComponentCompletions(componentMatch[1]);
    }

    const context = contextParser.getContext(document, params.position);
    if (!context) return [];

    const category = getProviderCategory(
      context.functionName,
      context.className
    );

    switch (category) {
      case "route":
        return routeCompletion?.provideCompletions(context.prefix) ?? [];
      case "view":
        return viewCompletion?.provideCompletions(context.prefix) ?? [];
      case "config":
        return configCompletion?.provideCompletions(context.prefix) ?? [];
      case "translation":
        return translationCompletion?.provideCompletions(context.prefix) ?? [];
      case "env":
        return envCompletion?.provideCompletions(context.prefix) ?? [];
      case "middleware":
        return middlewareCompletion?.provideCompletions(context.prefix) ?? [];
      case "eloquent_column":
        return eloquentCompletion?.provideColumnStringCompletions(
          resolveModelFromContext(context),
          context.prefix
        ) ?? [];
      case "eloquent_relation":
        return eloquentCompletion?.provideRelationCompletions(
          resolveModelFromContext(context),
          context.prefix
        ) ?? [];
      case "validation":
        return validationCompletion?.provideCompletions(context.prefix) ?? [];
      case "gate":
        return gateCompletion?.provideCompletions(context.prefix) ?? [];
      case "livewire":
        return livewireCompletion?.provideCompletions(context.prefix) ?? [];
      case "inertia":
        return inertiaCompletion?.provideCompletions(context.prefix) ?? [];
      default:
        return [];
    }
  }
);

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return item;
});

// ─── Definition ──────────────────────────────────────────────────────

connection.onDefinition(
  async (params: DefinitionParams): Promise<Definition | null> => {
    if (!contextParser || !projectInfo?.isLaravel) return null;

    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const context = contextParser.getStringAtPosition(
      document,
      params.position
    );
    if (!context) return null;

    const category = getProviderCategory(
      context.functionName,
      context.className
    );

    switch (category) {
      case "route":
        return routeDefinition?.provideDefinition(context.prefix) ?? null;
      case "view":
        return viewDefinition?.provideDefinition(context.prefix) ?? null;
      case "config":
        return configDefinition?.provideDefinition(context.prefix) ?? null;
      case "translation":
        return translationDefinition?.provideDefinition(context.prefix) ?? null;
      case "eloquent_column":
      case "eloquent_relation":
        return eloquentDefinition?.provideDefinition(
          resolveModelFromContext(context)
        ) ?? null;
      case "livewire":
        return livewireDefinition?.provideDefinition(context.prefix) ?? null;
      case "inertia":
        return inertiaDefinition?.provideDefinition(context.prefix) ?? null;
      default:
        return null;
    }
  }
);

// ─── Hover ───────────────────────────────────────────────────────────

connection.onHover(
  async (params: HoverParams): Promise<Hover | null> => {
    if (!contextParser || !projectInfo?.isLaravel) return null;

    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const context = contextParser.getStringAtPosition(
      document,
      params.position
    );
    if (!context) return null;

    const category = getProviderCategory(
      context.functionName,
      context.className
    );

    switch (category) {
      case "route":
        return buildRouteHover(context.prefix);
      case "view":
        return buildViewHover(context.prefix);
      case "config":
        return buildConfigHover(context.prefix);
      case "translation":
        return buildTranslationHover(context.prefix);
      case "env":
        return buildEnvHover(context.prefix);
      case "livewire":
        return buildLivewireHover(context.prefix);
      case "gate":
        return buildGateHover(context.prefix);
      default:
        return null;
    }
  }
);

// ─── Code Actions ────────────────────────────────────────────────────

connection.onCodeAction(
  (params: CodeActionParams): CodeAction[] => {
    if (!codeActionProvider) return [];
    return codeActionProvider.provideCodeActions(params.context.diagnostics);
  }
);

// ─── Diagnostics (on document change) ────────────────────────────────

let diagnosticDebounceTimer: ReturnType<typeof setTimeout> | undefined;

documents.onDidChangeContent((change) => {
  if (!diagnosticProvider || !projectInfo?.isLaravel) return;

  // Skip diagnostics if repositories haven't loaded yet
  if (!routeRepo?.count() && !viewRepo?.count() && !configRepo?.count()) return;

  // Debounce diagnostics to avoid excessive computation on every keystroke
  if (diagnosticDebounceTimer) clearTimeout(diagnosticDebounceTimer);
  diagnosticDebounceTimer = setTimeout(() => {
    const diagnostics = diagnosticProvider!.provideDiagnostics(change.document);
    connection.sendDiagnostics({
      uri: change.document.uri,
      diagnostics,
    });
  }, 500);
});

// ─── Hover builders ──────────────────────────────────────────────────

function buildRouteHover(name: string): Hover | null {
  const route = routeRepo?.findByName(name);
  if (!route) return null;
  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: [
        `**Route:** \`${route.name}\``,
        `**URI:** \`${route.methods.join("|")} /${route.uri}\``,
        `**Action:** \`${route.action}\``,
        route.middleware.length > 0
          ? `**Middleware:** ${route.middleware.join(", ")}`
          : "",
        route.parameters.length > 0
          ? `**Parameters:** ${route.parameters.map((p) => `{${p}}`).join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  };
}

function buildViewHover(name: string): Hover | null {
  const view = viewRepo?.findByName(name);
  if (!view) return null;
  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: `**View:** \`${view.name}\`\n\n**Path:** \`${view.relativePath}\``,
    },
  };
}

function buildConfigHover(key: string): Hover | null {
  const config = configRepo?.findByKey(key);
  if (!config) return null;
  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: [
        `**Config:** \`${config.key}\``,
        `**Value:** \`${config.value}\``,
        `**File:** \`${config.file}\``,
      ].join("\n\n"),
    },
  };
}

function buildTranslationHover(key: string): Hover | null {
  const t = translationRepo?.findByKey(key);
  if (!t) return null;
  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: [
        `**Translation:** \`${t.key}\``,
        t.value ? `**Value:** ${t.value}` : "",
        `**Locale:** \`${t.locale}\``,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  };
}

function buildEnvHover(key: string): Hover | null {
  const v = envRepo?.findByKey(key);
  if (!v) return null;
  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: [
        `**Env:** \`${v.key}\``,
        `**Value:** \`${v.value || "(empty)"}\``,
        v.comment ? `**Comment:** ${v.comment}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  };
}

function buildLivewireHover(name: string): Hover | null {
  const comp = livewireRepo?.findByName(name);
  if (!comp) return null;
  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: [
        `**Livewire Component:** \`${comp.name}\``,
        `**Class:** \`${comp.className}\``,
        comp.properties.length > 0
          ? `**Properties:** ${comp.properties.map((p) => `\`${p.name}\``).join(", ")}`
          : "",
        comp.methods.length > 0
          ? `**Actions:** ${comp.methods.map((m) => `\`${m}()\``).join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  };
}

function buildGateHover(name: string): Hover | null {
  const gate = gateRepo?.findGate(name);
  if (gate) {
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: `**Gate:** \`${gate.name}\`${gate.handler ? `\n\n**Handler:** \`${gate.handler}\`` : ""}`,
      },
    };
  }
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Attempt to resolve the Eloquent model name from context.
 * In patterns like User::where('column') or $user->where('column'),
 * we try to get the model name from the class context.
 */
function resolveModelFromContext(context: FunctionCallContext): string {
  // Direct class name: User::where(...)
  if (context.className) {
    return context.className;
  }
  // TODO: Infer from variable type analysis
  return "";
}

// ─── File watching ───────────────────────────────────────────────────

connection.onDidChangeWatchedFiles((params: DidChangeWatchedFilesParams) => {
  for (const change of params.changes) {
    const filePath = URI.parse(change.uri).fsPath;

    if (filePath.includes("/routes/")) {
      routeRepo?.reload();
    } else if (filePath.includes("/resources/views/")) {
      viewRepo?.reload();
      bladeComponentRepo?.reload();
    } else if (filePath.includes("/config/")) {
      configRepo?.reload();
    } else if (filePath.includes("/lang/") || filePath.includes("/resources/lang/")) {
      translationRepo?.reload();
    } else if (filePath.endsWith(".env") || filePath.endsWith(".env.example")) {
      envRepo?.reload();
    } else if (filePath.includes("/app/Livewire/") || filePath.includes("/app/Http/Livewire/")) {
      livewireRepo?.reload();
    } else if (filePath.includes("/app/Models/") && filePath.endsWith(".php")) {
      modelRepo?.reload();
    }
  }
});

connection.onShutdown(() => {
  fileWatcher?.dispose();
});

// Wire up
documents.listen(connection);
connection.listen();
