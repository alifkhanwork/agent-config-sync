type KnownProvider = 'openai' | 'anthropic' | 'google' | 'ollama' | 'openrouter' | 'azure' | 'cohere';
type ProviderKey = KnownProvider | (string & {});
interface ProviderConfig {
    keychainRef: string;
    defaultModel?: string;
    baseUrl?: string;
    customHeaders?: Record<string, string>;
}
type KnownToolId = 'cursor' | 'claude-code' | 'cline' | 'codex' | 'windsurf' | 'continue-dev';
type ToolId = KnownToolId | (string & {});
interface ToolOverride {
    enabled: boolean;
    providerOverrides?: Record<string, {
        defaultModel?: string;
        baseUrl?: string;
    }>;
    customConfigPath?: string;
}
interface CanonicalConfig {
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
interface SyncOptions {
    dryRun?: boolean;
    force?: boolean;
    tools?: string[];
    projectPath?: string;
}
interface AdapterResult {
    toolId: string;
    toolName: string;
    success: boolean;
    filePath: string;
    action: 'created' | 'updated' | 'unchanged' | 'skipped' | 'error';
    changes: string[];
    error?: string;
    drifted?: boolean;
}
interface DriftStatus {
    toolId: string;
    toolName: string;
    installed: boolean;
    configPath: string;
    exists: boolean;
    drifted: boolean;
    reason?: string;
}
interface DoctorCheckResult {
    name: string;
    status: 'ok' | 'warn' | 'error';
    message: string;
    details?: string[];
}

declare class ConfigStore {
    private configPath;
    constructor(customPath?: string);
    getConfigPath(): string;
    exists(): boolean;
    getDefaultConfig(): CanonicalConfig;
    read(projectPath?: string): CanonicalConfig;
    write(config: CanonicalConfig): void;
    setProvider(provider: string, config: ProviderConfig): void;
    removeProvider(provider: string): void;
    setSyncTarget(toolId: string, enabled: boolean): void;
    setToolOverride(toolId: string, override: ToolOverride): void;
    updateHashes(hashes: Record<string, string>): void;
    private mergeConfig;
}

declare class KeychainManager {
    private fallbackVaultPath;
    private vaultKeyPath;
    constructor(customDir?: string);
    isNativeSupported(): boolean;
    /**
     * Saves a secret to the native keychain (or encrypted fallback vault).
     * Returns a keychain reference string, e.g. "agent-config-sync:openai"
     */
    setSecret(account: string, secret: string): Promise<string>;
    /**
     * Retrieves a secret by its keychain reference or account name.
     */
    getSecret(refOrAccount: string): Promise<string | null>;
    /**
     * Deletes a secret from keychain / vault.
     */
    deleteSecret(refOrAccount: string): Promise<boolean>;
    private getOrCreateVaultMasterKey;
    private readVault;
    private writeVault;
    private setVaultSecret;
    private getVaultSecret;
    private deleteVaultSecret;
}

declare class SyncEngine {
    private configStore;
    private keychain;
    constructor(configStore?: ConfigStore, keychain?: KeychainManager);
    /**
     * Resolves all provider secrets from keychain.
     */
    getResolvedSecrets(config: CanonicalConfig): Promise<Record<string, string>>;
    /**
     * Synchronizes central config to native tool configs.
     */
    sync(options?: SyncOptions): Promise<AdapterResult[]>;
    /**
     * Performs drift check across all adapters.
     */
    getDriftStatus(projectPath?: string): Promise<DriftStatus[]>;
}

/**
 * Creates a backup copy of a configuration file before modifying it.
 * Example: 'settings.json' -> 'settings.json.2026-08-05_103000.bak'
 */
declare function createBackup(filePath: string): Promise<string | null>;

/**
 * Masks a secret string (e.g., API key) for safe logging and display.
 * Example: 'sk-ant-api03-abcdef123456' -> 'sk-ant-***3456'
 */
declare function maskSecret(secret: string | null | undefined): string;
/**
 * Sanitizes arbitrary text output by replacing known secret strings with masked placeholders.
 */
declare function maskSecretsInText(text: string, secrets: string[]): string;

declare abstract class BaseAdapter {
    abstract readonly id: string;
    abstract readonly name: string;
    /**
     * Returns the primary target configuration file path for this tool on the host OS.
     */
    abstract getConfigPath(overridePath?: string): string;
    /**
     * Checks if the tool or its config directory is installed on the host system.
     */
    abstract isInstalled(): Promise<boolean>;
    /**
     * Reads current native configuration object.
     */
    abstract readConfig(overridePath?: string): Promise<Record<string, any>>;
    /**
     * Synchronizes canonical config and secrets into this tool's native configuration format.
     */
    abstract sync(centralConfig: CanonicalConfig, secrets: Record<string, string>, options: SyncOptions): Promise<AdapterResult>;
    /**
     * Checks if the native config has drifted from the central config or last synced state.
     */
    abstract checkDrift(centralConfig: CanonicalConfig, secrets: Record<string, string>): Promise<DriftStatus>;
    /**
     * Computes SHA-256 hash of configuration content string.
     */
    protected computeHash(content: string): string;
}

declare class CursorAdapter extends BaseAdapter {
    readonly id = "cursor";
    readonly name = "Cursor IDE";
    getConfigPath(overridePath?: string): string;
    isInstalled(): Promise<boolean>;
    readConfig(overridePath?: string): Promise<Record<string, any>>;
    sync(centralConfig: CanonicalConfig, secrets: Record<string, string>, options: SyncOptions): Promise<AdapterResult>;
    checkDrift(centralConfig: CanonicalConfig, secrets: Record<string, string>): Promise<DriftStatus>;
}

declare class ClaudeCodeAdapter extends BaseAdapter {
    readonly id = "claude-code";
    readonly name = "Claude Code CLI";
    getConfigPath(overridePath?: string): string;
    getMcpConfigPath(): string;
    isInstalled(): Promise<boolean>;
    readConfig(overridePath?: string): Promise<Record<string, any>>;
    sync(centralConfig: CanonicalConfig, secrets: Record<string, string>, options: SyncOptions): Promise<AdapterResult>;
    checkDrift(centralConfig: CanonicalConfig, secrets: Record<string, string>): Promise<DriftStatus>;
}

declare class ClineAdapter extends BaseAdapter {
    readonly id = "cline";
    readonly name = "Cline Extension";
    getConfigPath(overridePath?: string): string;
    isInstalled(): Promise<boolean>;
    readConfig(overridePath?: string): Promise<Record<string, any>>;
    sync(centralConfig: CanonicalConfig, secrets: Record<string, string>, options: SyncOptions): Promise<AdapterResult>;
    checkDrift(centralConfig: CanonicalConfig, secrets: Record<string, string>): Promise<DriftStatus>;
}

declare class CodexCLIAdapter extends BaseAdapter {
    readonly id = "codex";
    readonly name = "Codex CLI";
    getConfigPath(overridePath?: string): string;
    isInstalled(): Promise<boolean>;
    readConfig(overridePath?: string): Promise<Record<string, any>>;
    sync(centralConfig: CanonicalConfig, secrets: Record<string, string>, options: SyncOptions): Promise<AdapterResult>;
    checkDrift(centralConfig: CanonicalConfig, secrets: Record<string, string>): Promise<DriftStatus>;
}

declare class WindsurfAdapter extends BaseAdapter {
    readonly id = "windsurf";
    readonly name = "Windsurf IDE";
    getConfigPath(overridePath?: string): string;
    getMcpConfigPath(): string;
    isInstalled(): Promise<boolean>;
    readConfig(overridePath?: string): Promise<Record<string, any>>;
    sync(centralConfig: CanonicalConfig, secrets: Record<string, string>, options: SyncOptions): Promise<AdapterResult>;
    checkDrift(centralConfig: CanonicalConfig, secrets: Record<string, string>): Promise<DriftStatus>;
}

declare class ContinueAdapter extends BaseAdapter {
    readonly id = "continue-dev";
    readonly name = "Continue.dev";
    getConfigPath(overridePath?: string): string;
    isInstalled(): Promise<boolean>;
    readConfig(overridePath?: string): Promise<Record<string, any>>;
    sync(centralConfig: CanonicalConfig, secrets: Record<string, string>, options: SyncOptions): Promise<AdapterResult>;
    checkDrift(centralConfig: CanonicalConfig, secrets: Record<string, string>): Promise<DriftStatus>;
}

declare function getAllAdapters(): BaseAdapter[];
declare function getAdapterById(id: string): BaseAdapter | undefined;

export { type AdapterResult, BaseAdapter, type CanonicalConfig, ClaudeCodeAdapter, ClineAdapter, CodexCLIAdapter, ConfigStore, ContinueAdapter, CursorAdapter, type DoctorCheckResult, type DriftStatus, KeychainManager, type KnownProvider, type KnownToolId, type ProviderConfig, type ProviderKey, SyncEngine, type SyncOptions, type ToolId, type ToolOverride, WindsurfAdapter, createBackup, getAdapterById, getAllAdapters, maskSecret, maskSecretsInText };
