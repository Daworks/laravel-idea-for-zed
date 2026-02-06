import {
  ServerCapabilities,
  TextDocumentSyncKind,
  CompletionOptions,
} from "vscode-languageserver";

export function getServerCapabilities(): ServerCapabilities {
  return {
    textDocumentSync: TextDocumentSyncKind.Incremental,
    completionProvider: getCompletionOptions(),
    hoverProvider: true,
    definitionProvider: true,
    codeActionProvider: true,
  };
}

function getCompletionOptions(): CompletionOptions {
  return {
    resolveProvider: true,
    // Trigger completion inside string literals for route(), view(), config(), etc.
    triggerCharacters: ["'", '"', ".", "/", ":", "@", "<", "-", "|"],
  };
}
