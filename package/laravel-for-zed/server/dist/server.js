"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const vscode_uri_1 = require("vscode-uri");
const capabilities_1 = require("./capabilities");
const project_1 = require("./support/project");
const php_1 = require("./analyzer/php");
const environment_1 = require("./analyzer/environment");
const parser_1 = require("./analyzer/parser");
const watcher_1 = require("./support/watcher");
// Repositories
const routes_1 = require("./repositories/routes");
const views_1 = require("./repositories/views");
const configs_1 = require("./repositories/configs");
const translations_1 = require("./repositories/translations");
const env_1 = require("./repositories/env");
const middleware_1 = require("./repositories/middleware");
const models_1 = require("./repositories/models");
const validation_1 = require("./repositories/validation");
const blade_components_1 = require("./repositories/blade-components");
const livewire_1 = require("./repositories/livewire");
const inertia_1 = require("./repositories/inertia");
const gates_1 = require("./repositories/gates");
// Completion providers
const routes_2 = require("./features/completion/routes");
const views_2 = require("./features/completion/views");
const configs_2 = require("./features/completion/configs");
const translations_2 = require("./features/completion/translations");
const env_2 = require("./features/completion/env");
const middleware_2 = require("./features/completion/middleware");
const eloquent_1 = require("./features/completion/eloquent");
const validation_2 = require("./features/completion/validation");
const blade_1 = require("./features/completion/blade");
const livewire_2 = require("./features/completion/livewire");
const inertia_2 = require("./features/completion/inertia");
const gates_2 = require("./features/completion/gates");
// Definition providers
const routes_3 = require("./features/definition/routes");
const views_3 = require("./features/definition/views");
const configs_3 = require("./features/definition/configs");
const translations_3 = require("./features/definition/translations");
const eloquent_2 = require("./features/definition/eloquent");
const blade_2 = require("./features/definition/blade");
const livewire_3 = require("./features/definition/livewire");
const inertia_3 = require("./features/definition/inertia");
// Diagnostic & CodeAction
const laravel_1 = require("./features/diagnostic/laravel");
const missingItems_1 = require("./features/codeAction/missingItems");
// Create LSP connection over stdio
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
// State
let projectInfo;
let contextParser;
let fileWatcher;
// Repositories
let routeRepo;
let viewRepo;
let configRepo;
let translationRepo;
let envRepo;
let middlewareRepo;
let modelRepo;
let validationRepo;
let bladeComponentRepo;
let livewireRepo;
let inertiaRepo;
let gateRepo;
// Completion providers
let routeCompletion;
let viewCompletion;
let configCompletion;
let translationCompletion;
let envCompletion;
let middlewareCompletion;
let eloquentCompletion;
let validationCompletion;
let bladeCompletion;
let livewireCompletion;
let inertiaCompletion;
let gateCompletion;
// Definition providers
let routeDefinition;
let viewDefinition;
let configDefinition;
let translationDefinition;
let eloquentDefinition;
let bladeDefinition;
let livewireDefinition;
let inertiaDefinition;
// Diagnostic & CodeAction
let diagnosticProvider;
let codeActionProvider;
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
function getProviderCategory(functionName, className) {
    // Check specific class context first
    if (className) {
        const cls = className.toLowerCase();
        if (cls === "view" || cls === "blade")
            return "view";
        if (cls === "config")
            return "config";
        if (cls === "route" || cls === "url" || cls === "redirect")
            return "route";
        if (cls === "lang" || cls === "translator")
            return "translation";
        if (cls === "gate")
            return "gate";
        if (cls === "inertia")
            return "inertia";
        if (cls === "livewire")
            return "livewire";
        if (cls === "validator")
            return "validation";
    }
    // Specific function matches
    if (ROUTE_FUNCTIONS.has(functionName))
        return "route";
    if (TRANSLATION_FUNCTIONS.has(functionName))
        return "translation";
    if (ENV_FUNCTIONS.has(functionName))
        return "env";
    if (MIDDLEWARE_FUNCTIONS.has(functionName))
        return "middleware";
    if (GATE_FUNCTIONS.has(functionName))
        return "gate";
    if (LIVEWIRE_FUNCTIONS.has(functionName))
        return "livewire";
    if (VALIDATION_FUNCTIONS.has(functionName))
        return "validation";
    // Eloquent query methods
    if (ELOQUENT_QUERY_FUNCTIONS.has(functionName))
        return "eloquent_column";
    if (ELOQUENT_MASS_FUNCTIONS.has(functionName))
        return "eloquent_column";
    if (RELATION_FUNCTIONS.has(functionName))
        return "eloquent_relation";
    // Ambiguous names
    if (functionName === "view")
        return "view";
    if (functionName === "config")
        return "config";
    // Blade directives and view helpers
    if (VIEW_FUNCTIONS.has(functionName))
        return "view";
    return null;
}
// ─── LSP Lifecycle ───────────────────────────────────────────────────
connection.onInitialize((params) => {
    const workspaceFolderUri = params.workspaceFolders?.[0]?.uri;
    const workspacePath = params.initializationOptions?.workspacePath ||
        (workspaceFolderUri ? vscode_uri_1.URI.parse(workspaceFolderUri).fsPath : "") ||
        "";
    connection.console.log(`[Laravel LS] Initializing for workspace: ${workspacePath}`);
    projectInfo = (0, project_1.detectLaravelProject)(workspacePath);
    if (!projectInfo.isLaravel) {
        connection.console.log(`[Laravel LS] Not a Laravel project, features will be limited`);
    }
    return {
        capabilities: (0, capabilities_1.getServerCapabilities)(),
        serverInfo: {
            name: "Laravel Language Server",
            version: "1.0.0",
        },
    };
});
connection.onInitialized(async () => {
    if (!projectInfo?.isLaravel)
        return;
    connection.console.log(`[Laravel LS] Setting up Laravel features...`);
    try {
        // Detect PHP environment
        const envDetector = new environment_1.EnvironmentDetector(projectInfo.rootPath);
        const phpEnv = await envDetector.detect();
        projectInfo.phpEnvironment = phpEnv;
        connection.console.log(`[Laravel LS] PHP environment: ${phpEnv.type} (${phpEnv.phpPath})`);
        const phpRunner = new php_1.PhpRunner(phpEnv, projectInfo.rootPath);
        // Detect Laravel version
        try {
            const version = await phpRunner.runInLaravel(`echo app()->version();`);
            projectInfo.laravelVersion = version.trim();
            connection.console.log(`[Laravel LS] Laravel version: ${projectInfo.laravelVersion}`);
        }
        catch {
            connection.console.log(`[Laravel LS] Could not detect Laravel version`);
        }
        // Initialize context parser
        contextParser = new parser_1.ContextParser();
        // Initialize repositories - PHP-dependent
        routeRepo = new routes_1.RouteRepository(phpRunner, connection);
        configRepo = new configs_1.ConfigRepository(phpRunner, connection);
        middlewareRepo = new middleware_1.MiddlewareRepository(phpRunner, connection);
        modelRepo = new models_1.ModelRepository(phpRunner, connection);
        validationRepo = new validation_1.ValidationRepository(phpRunner, connection);
        gateRepo = new gates_1.GateRepository(phpRunner, connection);
        // File-system-based repos
        viewRepo = new views_1.ViewRepository(projectInfo.rootPath, connection);
        translationRepo = new translations_1.TranslationRepository(projectInfo.rootPath, connection);
        envRepo = new env_1.EnvRepository(projectInfo.rootPath, connection);
        bladeComponentRepo = new blade_components_1.BladeComponentRepository(projectInfo.rootPath, connection);
        livewireRepo = new livewire_1.LivewireRepository(projectInfo.rootPath, connection);
        inertiaRepo = new inertia_1.InertiaRepository(projectInfo.rootPath, connection);
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
        routeCompletion = new routes_2.RouteCompletionProvider(routeRepo);
        viewCompletion = new views_2.ViewCompletionProvider(viewRepo);
        configCompletion = new configs_2.ConfigCompletionProvider(configRepo);
        translationCompletion = new translations_2.TranslationCompletionProvider(translationRepo);
        envCompletion = new env_2.EnvCompletionProvider(envRepo);
        middlewareCompletion = new middleware_2.MiddlewareCompletionProvider(middlewareRepo);
        eloquentCompletion = new eloquent_1.EloquentCompletionProvider(modelRepo);
        validationCompletion = new validation_2.ValidationCompletionProvider(validationRepo);
        bladeCompletion = new blade_1.BladeCompletionProvider(bladeComponentRepo);
        livewireCompletion = new livewire_2.LivewireCompletionProvider(livewireRepo);
        inertiaCompletion = new inertia_2.InertiaCompletionProvider(inertiaRepo);
        gateCompletion = new gates_2.GateCompletionProvider(gateRepo);
        // Initialize definition providers
        routeDefinition = new routes_3.RouteDefinitionProvider(routeRepo, projectInfo.rootPath);
        viewDefinition = new views_3.ViewDefinitionProvider(viewRepo);
        configDefinition = new configs_3.ConfigDefinitionProvider(configRepo, projectInfo.rootPath);
        translationDefinition = new translations_3.TranslationDefinitionProvider(translationRepo);
        eloquentDefinition = new eloquent_2.EloquentDefinitionProvider(modelRepo, projectInfo.rootPath);
        bladeDefinition = new blade_2.BladeDefinitionProvider(bladeComponentRepo);
        livewireDefinition = new livewire_3.LivewireDefinitionProvider(livewireRepo);
        inertiaDefinition = new inertia_3.InertiaDefinitionProvider(inertiaRepo);
        // Initialize diagnostic & code action providers
        diagnosticProvider = new laravel_1.LaravelDiagnosticProvider(routeRepo, viewRepo, configRepo);
        codeActionProvider = new missingItems_1.MissingItemsCodeActionProvider();
        // Watch files for changes
        fileWatcher = new watcher_1.FileWatcher(projectInfo.rootPath);
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
    }
    catch (e) {
        connection.console.log(`[Laravel LS] Error during initialization: ${e}`);
    }
});
// ─── Completion ──────────────────────────────────────────────────────
connection.onCompletion(async (params) => {
    if (!contextParser || !projectInfo?.isLaravel)
        return [];
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return [];
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
    if (!context)
        return [];
    const category = getProviderCategory(context.functionName, context.className);
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
            return eloquentCompletion?.provideColumnStringCompletions(resolveModelFromContext(context), context.prefix) ?? [];
        case "eloquent_relation":
            return eloquentCompletion?.provideRelationCompletions(resolveModelFromContext(context), context.prefix) ?? [];
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
});
connection.onCompletionResolve((item) => {
    return item;
});
// ─── Definition ──────────────────────────────────────────────────────
connection.onDefinition(async (params) => {
    if (!contextParser || !projectInfo?.isLaravel)
        return null;
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return null;
    const context = contextParser.getStringAtPosition(document, params.position);
    if (!context)
        return null;
    const category = getProviderCategory(context.functionName, context.className);
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
            return eloquentDefinition?.provideDefinition(resolveModelFromContext(context)) ?? null;
        case "livewire":
            return livewireDefinition?.provideDefinition(context.prefix) ?? null;
        case "inertia":
            return inertiaDefinition?.provideDefinition(context.prefix) ?? null;
        default:
            return null;
    }
});
// ─── Hover ───────────────────────────────────────────────────────────
connection.onHover(async (params) => {
    if (!contextParser || !projectInfo?.isLaravel)
        return null;
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return null;
    const context = contextParser.getStringAtPosition(document, params.position);
    if (!context)
        return null;
    const category = getProviderCategory(context.functionName, context.className);
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
});
// ─── Code Actions ────────────────────────────────────────────────────
connection.onCodeAction((params) => {
    if (!codeActionProvider)
        return [];
    return codeActionProvider.provideCodeActions(params.context.diagnostics);
});
// ─── Diagnostics (on document change) ────────────────────────────────
let diagnosticDebounceTimer;
documents.onDidChangeContent((change) => {
    if (!diagnosticProvider || !projectInfo?.isLaravel)
        return;
    // Skip diagnostics if repositories haven't loaded yet
    if (!routeRepo?.count() && !viewRepo?.count() && !configRepo?.count())
        return;
    // Debounce diagnostics to avoid excessive computation on every keystroke
    if (diagnosticDebounceTimer)
        clearTimeout(diagnosticDebounceTimer);
    diagnosticDebounceTimer = setTimeout(() => {
        const diagnostics = diagnosticProvider.provideDiagnostics(change.document);
        connection.sendDiagnostics({
            uri: change.document.uri,
            diagnostics,
        });
    }, 500);
});
// ─── Hover builders ──────────────────────────────────────────────────
function buildRouteHover(name) {
    const route = routeRepo?.findByName(name);
    if (!route)
        return null;
    return {
        contents: {
            kind: node_1.MarkupKind.Markdown,
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
function buildViewHover(name) {
    const view = viewRepo?.findByName(name);
    if (!view)
        return null;
    return {
        contents: {
            kind: node_1.MarkupKind.Markdown,
            value: `**View:** \`${view.name}\`\n\n**Path:** \`${view.relativePath}\``,
        },
    };
}
function buildConfigHover(key) {
    const config = configRepo?.findByKey(key);
    if (!config)
        return null;
    return {
        contents: {
            kind: node_1.MarkupKind.Markdown,
            value: [
                `**Config:** \`${config.key}\``,
                `**Value:** \`${config.value}\``,
                `**File:** \`${config.file}\``,
            ].join("\n\n"),
        },
    };
}
function buildTranslationHover(key) {
    const t = translationRepo?.findByKey(key);
    if (!t)
        return null;
    return {
        contents: {
            kind: node_1.MarkupKind.Markdown,
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
function buildEnvHover(key) {
    const v = envRepo?.findByKey(key);
    if (!v)
        return null;
    return {
        contents: {
            kind: node_1.MarkupKind.Markdown,
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
function buildLivewireHover(name) {
    const comp = livewireRepo?.findByName(name);
    if (!comp)
        return null;
    return {
        contents: {
            kind: node_1.MarkupKind.Markdown,
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
function buildGateHover(name) {
    const gate = gateRepo?.findGate(name);
    if (gate) {
        return {
            contents: {
                kind: node_1.MarkupKind.Markdown,
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
function resolveModelFromContext(context) {
    // Direct class name: User::where(...)
    if (context.className) {
        return context.className;
    }
    // TODO: Infer from variable type analysis
    return "";
}
// ─── File watching ───────────────────────────────────────────────────
connection.onDidChangeWatchedFiles((params) => {
    for (const change of params.changes) {
        const filePath = vscode_uri_1.URI.parse(change.uri).fsPath;
        if (filePath.includes("/routes/")) {
            routeRepo?.reload();
        }
        else if (filePath.includes("/resources/views/")) {
            viewRepo?.reload();
            bladeComponentRepo?.reload();
        }
        else if (filePath.includes("/config/")) {
            configRepo?.reload();
        }
        else if (filePath.includes("/lang/") || filePath.includes("/resources/lang/")) {
            translationRepo?.reload();
        }
        else if (filePath.endsWith(".env") || filePath.endsWith(".env.example")) {
            envRepo?.reload();
        }
        else if (filePath.includes("/app/Livewire/") || filePath.includes("/app/Http/Livewire/")) {
            livewireRepo?.reload();
        }
        else if (filePath.includes("/app/Models/") && filePath.endsWith(".php")) {
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
//# sourceMappingURL=server.js.map