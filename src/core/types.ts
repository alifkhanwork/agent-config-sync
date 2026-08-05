export type KnownProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'ollama'
  | 'openrouter'
  | 'azure'
  | 'cohere';

export type ProviderKey = KnownProvider | (string & {});

export interface ProviderConfig {
  keychainRef: string;
  defaultModel?: string;
  baseUrl?: string;
  customHeaders?: Record<string, string>;
}

export type KnownToolId =
  | 'cursor'
  | 'claude-code'
  | 'cline'
  | 'codex'
  | 'windsurf'
  | 'continue-dev';

export type ToolId = KnownToolId | (string & {});

export interface ToolOverride {
  enabled: boolean;
  providerOverrides?: Record<string, { defaultModel?: string; baseUrl?: string }>;
  customConfigPath?: string;
}

export interface CanonicalConfig {
  version: string;
  providers: Record<string, ProviderConfig>;
  defaults: {
    primaryProvider?: string;
    defaultModel?: string;
    taskModels?: Record<string, string>;
  };
  syncTargets: Record<string, boolean>;
  tools: Record<string, ToolOverride>;
  hashes?: Record<string, string>;
  lastSyncedAt?: string;
}

export interface SyncOptions {
  dryRun?: boolean;
  force?: boolean;
  tools?: string[];
  projectPath?: string;
}

export interface AdapterResult {
  toolId: string;
  toolName: string;
  success: boolean;
  filePath: string;
  action: 'created' | 'updated' | 'unchanged' | 'skipped' | 'error';
  changes: string[];
  error?: string;
  drifted?: boolean;
}

export interface DriftStatus {
  toolId: string;
  toolName: string;
  installed: boolean;
  configPath: string;
  exists: boolean;
  drifted: boolean;
  reason?: string;
}

export interface DoctorCheckResult {
  name: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
  details?: string[];
}
