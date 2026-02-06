import { CompletionItem } from "vscode-languageserver";

/** Route information collected from Laravel application */
export interface RouteInfo {
  name: string;
  uri: string;
  methods: string[];
  action: string;
  controller?: string;
  controllerMethod?: string;
  controllerFilePath?: string;
  controllerFileLine?: number;
  middleware: string[];
  parameters: string[];
}

/** View information */
export interface ViewInfo {
  name: string;
  relativePath: string;
  absolutePath: string;
}

/** Config information */
export interface ConfigInfo {
  key: string;
  value: string;
  file: string;
  line?: number;
  hasChildren?: boolean;
}

/** Translation information */
export interface TranslationInfo {
  key: string;
  value: string;
  locale: string;
  file: string;
}

/** Middleware information */
export interface MiddlewareInfo {
  name: string;
  class: string;
  filePath?: string;
}

/** Eloquent model information */
export interface ModelInfo {
  name: string;
  tableName: string;
  filePath: string;
  attributes: ModelAttribute[];
  relations: ModelRelation[];
  scopes: string[];
}

export interface ModelAttribute {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
  cast?: string;
}

export interface ModelRelation {
  name: string;
  type: string;
  relatedModel: string;
}

/** PHP environment configuration */
export interface PhpEnvironment {
  phpPath: string;
  type: "system" | "herd" | "valet" | "sail" | "docker";
  version?: string;
}

/** Workspace project info */
export interface ProjectInfo {
  rootPath: string;
  isLaravel: boolean;
  phpEnvironment?: PhpEnvironment;
  laravelVersion?: string;
}

/** Function call context detected by parser */
export interface FunctionCallContext {
  functionName: string;
  className?: string;
  parameterIndex: number;
  prefix: string;
  fullMatch: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

/** Provider-specific completion result */
export interface ProviderCompletionResult {
  items: CompletionItem[];
  isIncomplete?: boolean;
}
