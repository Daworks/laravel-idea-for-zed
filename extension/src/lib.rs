use std::fs;
use zed_extension_api::{self as zed, serde_json, LanguageServerId, Result};

struct LaravelExtension {
    server_script_path: Option<String>,
}

impl LaravelExtension {
    /// Find or install the Laravel LSP server and return the path to server.js
    fn server_script(
        &mut self,
        language_server_id: &LanguageServerId,
    ) -> Result<String> {
        if let Some(path) = &self.server_script_path {
            if fs::metadata(path).is_ok() {
                return Ok(path.clone());
            }
        }

        let server_path = self.install_server(language_server_id)?;
        self.server_script_path = Some(server_path.clone());
        Ok(server_path)
    }

    /// Install the LSP server via npm
    fn install_server(&self, language_server_id: &LanguageServerId) -> Result<String> {
        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::CheckingForUpdate,
        );

        let server_dir = "node_modules/laravel-language-server";
        let server_entry = format!("{server_dir}/dist/server.js");

        // Check if already installed
        if fs::metadata(&server_entry).is_ok() {
            zed::set_language_server_installation_status(
                language_server_id,
                &zed::LanguageServerInstallationStatus::None,
            );
            return Ok(server_entry);
        }

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::Downloading,
        );

        // For development: use the local server directory
        // In production: install from npm
        let result = zed::npm_install_package("laravel-language-server", "latest");

        match result {
            Ok(()) => {
                zed::set_language_server_installation_status(
                    language_server_id,
                    &zed::LanguageServerInstallationStatus::None,
                );
                Ok(server_entry)
            }
            Err(e) => {
                zed::set_language_server_installation_status(
                    language_server_id,
                    &zed::LanguageServerInstallationStatus::Failed(format!(
                        "Failed to install Laravel Language Server: {e}"
                    )),
                );
                Err(e)
            }
        }
    }
}

impl zed::Extension for LaravelExtension {
    fn new() -> Self {
        LaravelExtension {
            server_script_path: None,
        }
    }

    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let server_script = self.server_script(language_server_id)?;

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![
                server_script,
                "--stdio".to_string(),
            ],
            env: Default::default(),
        })
    }

    fn language_server_initialization_options(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<Option<serde_json::Value>> {
        Ok(Some(serde_json::json!({
            "workspacePath": worktree.root_path(),
        })))
    }

    fn label_for_completion(
        &self,
        _language_server_id: &LanguageServerId,
        completion: zed::lsp::Completion,
    ) -> Option<zed::CodeLabel> {
        let kind = completion.kind?;
        let label = &completion.label;

        match kind {
            // Route completions (Value)
            zed::lsp::CompletionKind::Value => {
                Some(zed::CodeLabel {
                    code: label.clone(),
                    spans: vec![zed::CodeLabelSpan::literal(label, Some("string".into()))],
                    filter_range: (0..label.len()).into(),
                })
            }
            // View / Inertia page completions (File)
            zed::lsp::CompletionKind::File => {
                Some(zed::CodeLabel {
                    code: label.clone(),
                    spans: vec![zed::CodeLabelSpan::literal(label, Some("string.special".into()))],
                    filter_range: (0..label.len()).into(),
                })
            }
            // Eloquent field completions (Field)
            zed::lsp::CompletionKind::Field => {
                Some(zed::CodeLabel {
                    code: label.clone(),
                    spans: vec![zed::CodeLabelSpan::literal(label, Some("property".into()))],
                    filter_range: (0..label.len()).into(),
                })
            }
            // Model / Livewire class completions (Class)
            zed::lsp::CompletionKind::Class => {
                Some(zed::CodeLabel {
                    code: label.clone(),
                    spans: vec![zed::CodeLabelSpan::literal(label, Some("type".into()))],
                    filter_range: (0..label.len()).into(),
                })
            }
            // Blade component completions (Module)
            zed::lsp::CompletionKind::Module => {
                Some(zed::CodeLabel {
                    code: format!("x-{}", label),
                    spans: vec![
                        zed::CodeLabelSpan::literal("x-", Some("tag".into())),
                        zed::CodeLabelSpan::literal(label, Some("tag".into())),
                    ],
                    filter_range: (0..label.len() + 2).into(),
                })
            }
            // Snippet completions (Blade directives)
            zed::lsp::CompletionKind::Snippet => {
                Some(zed::CodeLabel {
                    code: label.clone(),
                    spans: vec![zed::CodeLabelSpan::literal(label, Some("keyword".into()))],
                    filter_range: (0..label.len()).into(),
                })
            }
            // Validation rule / Middleware completions (EnumMember)
            zed::lsp::CompletionKind::EnumMember => {
                Some(zed::CodeLabel {
                    code: label.clone(),
                    spans: vec![zed::CodeLabelSpan::literal(label, Some("constant".into()))],
                    filter_range: (0..label.len()).into(),
                })
            }
            // Relation completions (Reference)
            zed::lsp::CompletionKind::Reference => {
                Some(zed::CodeLabel {
                    code: label.clone(),
                    spans: vec![zed::CodeLabelSpan::literal(label, Some("function".into()))],
                    filter_range: (0..label.len()).into(),
                })
            }
            // Method/Scope completions
            zed::lsp::CompletionKind::Method => {
                Some(zed::CodeLabel {
                    code: format!("{}()", label),
                    spans: vec![
                        zed::CodeLabelSpan::literal(label, Some("function".into())),
                        zed::CodeLabelSpan::literal("()", Some("punctuation".into())),
                    ],
                    filter_range: (0..label.len()).into(),
                })
            }
            // Gate/Event completions
            zed::lsp::CompletionKind::Event => {
                Some(zed::CodeLabel {
                    code: label.clone(),
                    spans: vec![zed::CodeLabelSpan::literal(label, Some("string".into()))],
                    filter_range: (0..label.len()).into(),
                })
            }
            _ => None,
        }
    }

    fn run_slash_command(
        &self,
        command: zed::SlashCommand,
        _args: Vec<String>,
        _worktree: Option<&zed::Worktree>,
    ) -> Result<zed::SlashCommandOutput> {
        match command.name.as_str() {
            "laravel:make" => {
                let args_str = _args.join(" ");
                if args_str.is_empty() {
                    return Ok(zed::SlashCommandOutput {
                        text: "Usage: /laravel:make <type> <name> [options]\n\nExamples:\n  /laravel:make model User --migration --factory\n  /laravel:make controller UserController --resource\n  /laravel:make migration create_posts_table\n  /laravel:make livewire Counter\n  /laravel:make request StoreUserRequest\n  /laravel:make middleware EnsureTokenIsValid".to_string(),
                        sections: vec![],
                    });
                }

                Ok(zed::SlashCommandOutput {
                    text: format!(
                        "Run this artisan command in your Laravel project:\n\n```bash\nphp artisan make:{}\n```\n\nThis will generate the corresponding Laravel file with the proper boilerplate.",
                        args_str
                    ),
                    sections: vec![],
                })
            }
            "laravel:routes" => {
                Ok(zed::SlashCommandOutput {
                    text: "Run this command to see all registered routes:\n\n```bash\nphp artisan route:list\n```".to_string(),
                    sections: vec![],
                })
            }
            "laravel:migrate" => {
                let action = _args.first().map(|s| s.as_str()).unwrap_or("status");
                let cmd = match action {
                    "fresh" => "php artisan migrate:fresh",
                    "rollback" => "php artisan migrate:rollback",
                    "reset" => "php artisan migrate:reset",
                    "status" => "php artisan migrate:status",
                    _ => "php artisan migrate",
                };
                Ok(zed::SlashCommandOutput {
                    text: format!("```bash\n{}\n```", cmd),
                    sections: vec![],
                })
            }
            _ => Ok(zed::SlashCommandOutput {
                text: format!("Unknown command: {}", command.name),
                sections: vec![],
            }),
        }
    }

    fn complete_slash_command_argument(
        &self,
        command: zed::SlashCommand,
        _args: Vec<String>,
    ) -> Result<Vec<zed::SlashCommandArgumentCompletion>> {
        match command.name.as_str() {
            "laravel:make" => {
                if _args.is_empty() {
                    Ok(vec![
                        zed::SlashCommandArgumentCompletion {
                            label: "model".to_string(),
                            new_text: "model ".to_string(),
                            run_command: false,
                        },
                        zed::SlashCommandArgumentCompletion {
                            label: "controller".to_string(),
                            new_text: "controller ".to_string(),
                            run_command: false,
                        },
                        zed::SlashCommandArgumentCompletion {
                            label: "migration".to_string(),
                            new_text: "migration ".to_string(),
                            run_command: false,
                        },
                        zed::SlashCommandArgumentCompletion {
                            label: "request".to_string(),
                            new_text: "request ".to_string(),
                            run_command: false,
                        },
                        zed::SlashCommandArgumentCompletion {
                            label: "resource".to_string(),
                            new_text: "resource ".to_string(),
                            run_command: false,
                        },
                        zed::SlashCommandArgumentCompletion {
                            label: "middleware".to_string(),
                            new_text: "middleware ".to_string(),
                            run_command: false,
                        },
                        zed::SlashCommandArgumentCompletion {
                            label: "seeder".to_string(),
                            new_text: "seeder ".to_string(),
                            run_command: false,
                        },
                        zed::SlashCommandArgumentCompletion {
                            label: "factory".to_string(),
                            new_text: "factory ".to_string(),
                            run_command: false,
                        },
                        zed::SlashCommandArgumentCompletion {
                            label: "policy".to_string(),
                            new_text: "policy ".to_string(),
                            run_command: false,
                        },
                        zed::SlashCommandArgumentCompletion {
                            label: "event".to_string(),
                            new_text: "event ".to_string(),
                            run_command: false,
                        },
                        zed::SlashCommandArgumentCompletion {
                            label: "listener".to_string(),
                            new_text: "listener ".to_string(),
                            run_command: false,
                        },
                        zed::SlashCommandArgumentCompletion {
                            label: "job".to_string(),
                            new_text: "job ".to_string(),
                            run_command: false,
                        },
                        zed::SlashCommandArgumentCompletion {
                            label: "mail".to_string(),
                            new_text: "mail ".to_string(),
                            run_command: false,
                        },
                        zed::SlashCommandArgumentCompletion {
                            label: "notification".to_string(),
                            new_text: "notification ".to_string(),
                            run_command: false,
                        },
                        zed::SlashCommandArgumentCompletion {
                            label: "livewire".to_string(),
                            new_text: "livewire ".to_string(),
                            run_command: false,
                        },
                        zed::SlashCommandArgumentCompletion {
                            label: "rule".to_string(),
                            new_text: "rule ".to_string(),
                            run_command: false,
                        },
                        zed::SlashCommandArgumentCompletion {
                            label: "test".to_string(),
                            new_text: "test ".to_string(),
                            run_command: false,
                        },
                    ])
                } else {
                    Ok(vec![])
                }
            }
            "laravel:migrate" => {
                Ok(vec![
                    zed::SlashCommandArgumentCompletion {
                        label: "run".to_string(),
                        new_text: "run".to_string(),
                        run_command: true,
                    },
                    zed::SlashCommandArgumentCompletion {
                        label: "fresh".to_string(),
                        new_text: "fresh".to_string(),
                        run_command: true,
                    },
                    zed::SlashCommandArgumentCompletion {
                        label: "rollback".to_string(),
                        new_text: "rollback".to_string(),
                        run_command: true,
                    },
                    zed::SlashCommandArgumentCompletion {
                        label: "status".to_string(),
                        new_text: "status".to_string(),
                        run_command: true,
                    },
                ])
            }
            _ => Ok(vec![]),
        }
    }
}

zed::register_extension!(LaravelExtension);
