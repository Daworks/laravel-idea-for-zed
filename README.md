# Laravel for Zed

Full-featured Laravel development extension for [Zed](https://zed.dev). Provides intelligent autocomplete, go-to-definition, diagnostics, and code generation for Laravel projects.

> Inspired by [Laravel Idea](https://laravel-idea.com/) for PhpStorm.

## Features

### Autocomplete

| Context | Example | What it completes |
|---------|---------|-------------------|
| Routes | `route('` | Named route names |
| Views | `view('` | Blade view names (dot notation) |
| Config | `config('` | Configuration keys |
| Translations | `__('`, `trans('` | Translation keys |
| Env | `env('` | `.env` variable names |
| Middleware | `->middleware('` | Middleware aliases and groups |
| Eloquent | `User::where('` | Model columns, relations, scopes |
| Validation | `'required\|` | 90+ validation rules |
| Blade | `@if`, `<x-` | 60+ directives, components, props |
| Livewire | `@livewire('` | Livewire components, properties, methods |
| Inertia | `Inertia::render('` | Vue/React/Svelte page components |
| Gates | `Gate::allows('` | Gate abilities and policy methods |

### Go-to-Definition

`Cmd+Click` (or `Ctrl+Click`) on:

- Route names &rarr; controller action
- View names &rarr; Blade template file
- Config keys &rarr; config file and line
- Translation keys &rarr; language file
- Eloquent models &rarr; model class file
- Blade components &rarr; component template/class
- Livewire components &rarr; component class
- Inertia pages &rarr; page component file

### Diagnostics

Warnings for references that don't exist:
- Unknown route names
- Missing view templates
- Invalid config keys

With quick-fix code actions (e.g., "Create missing view").

### Slash Commands

Use in Zed's AI assistant panel:

- `/laravel:make` &mdash; Generate Laravel files (model, controller, migration, etc.)
- `/laravel:routes` &mdash; List all registered routes
- `/laravel:migrate` &mdash; Run database migrations

## Requirements

- [Zed](https://zed.dev) editor
- [Node.js](https://nodejs.org) >= 18
- PHP >= 8.0
- A Laravel project (detected via `bootstrap/app.php`)

### Supported PHP Environments

The extension auto-detects your PHP setup:

- Laravel Herd
- Laravel Valet
- Laravel Sail (Docker)
- System PHP

## Installation

### From Zed Extensions (coming soon)

Search for "Laravel" in Zed's extension marketplace.

### Development Install

```bash
# Clone the repository
git clone https://github.com/Daworks/laravel-idea-for-zed.git
cd laravel-idea-for-zed

# Build everything
./scripts/build.sh

# Install as dev extension in Zed:
# 1. Open Zed
# 2. Cmd+Shift+P → "zed: install dev extension"
# 3. Select the extension/ directory
```

### Development Mode

```bash
# Watch for changes and auto-rebuild
./scripts/dev.sh
```

## Architecture

```
zed-laravel/
├── extension/          # Zed Extension (Rust → WASM)
│   ├── extension.toml  # Extension metadata & slash commands
│   └── src/lib.rs      # LSP lifecycle, label styling, slash commands
│
├── server/             # Laravel LSP Server (TypeScript)
│   └── src/
│       ├── server.ts           # LSP entry point
│       ├── analyzer/           # PHP execution & context parsing
│       ├── repositories/       # Data collection (12 providers)
│       ├── features/
│       │   ├── completion/     # Autocomplete (12 providers)
│       │   ├── definition/     # Go-to-definition (8 providers)
│       │   ├── diagnostic/     # Error detection
│       │   └── codeAction/     # Quick fixes
│       └── support/            # Cache, project detection, file watching
│
└── scripts/            # Build & development scripts
```

### How It Works

1. **Zed Extension** (Rust/WASM) manages the LSP server lifecycle and provides UI customization
2. **LSP Server** (Node.js) handles all language intelligence via the Language Server Protocol
3. **PHP Execution** &mdash; the server bootstraps your Laravel app to extract routes, config, models, etc. via PHP reflection
4. **File Scanning** &mdash; Blade components, Livewire, Inertia pages, translations, and env variables are collected by scanning the filesystem
5. Communication happens over `stdio` using the standard LSP protocol

## Building from Source

### Prerequisites

- [Rust](https://rustup.rs/) with `wasm32-wasip1` target
- Node.js >= 18
- npm

```bash
# Install Rust (if needed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add WASM target
rustup target add wasm32-wasip1

# Build
./scripts/build.sh
```

## License

MIT

