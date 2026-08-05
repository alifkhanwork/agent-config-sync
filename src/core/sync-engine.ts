import { ConfigStore } from './config-store';
import { KeychainManager } from './keychain';
import { getAllAdapters, BaseAdapter } from '../adapters';
import { CanonicalConfig, SyncOptions, AdapterResult, DriftStatus } from './types';

export class SyncEngine {
  private configStore: ConfigStore;
  private keychain: KeychainManager;

  constructor(configStore?: ConfigStore, keychain?: KeychainManager) {
    this.configStore = configStore || new ConfigStore();
    this.keychain = keychain || new KeychainManager();
  }

  /**
   * Resolves all provider secrets from keychain.
   */
  public async getResolvedSecrets(config: CanonicalConfig): Promise<Record<string, string>> {
    const secrets: Record<string, string> = {};

    for (const [provider, pConfig] of Object.entries(config.providers)) {
      if (pConfig.keychainRef) {
        const key = await this.keychain.getSecret(pConfig.keychainRef);
        if (key) {
          secrets[provider] = key;
        }
      }
    }

    return secrets;
  }

  /**
   * Synchronizes central config to native tool configs.
   */
  public async sync(options: SyncOptions = {}): Promise<AdapterResult[]> {
    const config = this.configStore.read(options.projectPath);
    const secrets = await this.getResolvedSecrets(config);

    const adapters = getAllAdapters().filter((adapter) => {
      // Filter by tools if option provided
      if (options.tools && options.tools.length > 0) {
        return options.tools.includes(adapter.id);
      }
      // Otherwise check syncTargets in config
      return config.syncTargets[adapter.id] !== false;
    });

    const results: AdapterResult[] = [];

    for (const adapter of adapters) {
      try {
        const result = await adapter.sync(config, secrets, options);
        results.push(result);
      } catch (err) {
        results.push({
          toolId: adapter.id,
          toolName: adapter.name,
          success: false,
          filePath: adapter.getConfigPath(),
          action: 'error',
          changes: [],
          error: (err as Error).message,
        });
      }
    }

    return results;
  }

  /**
   * Performs drift check across all adapters.
   */
  public async getDriftStatus(projectPath?: string): Promise<DriftStatus[]> {
    const config = this.configStore.read(projectPath);
    const secrets = await this.getResolvedSecrets(config);
    const adapters = getAllAdapters();

    const statuses: DriftStatus[] = [];

    for (const adapter of adapters) {
      try {
        const status = await adapter.checkDrift(config, secrets);
        statuses.push(status);
      } catch (err) {
        statuses.push({
          toolId: adapter.id,
          toolName: adapter.name,
          installed: false,
          configPath: adapter.getConfigPath(),
          exists: false,
          drifted: true,
          reason: (err as Error).message,
        });
      }
    }

    return statuses;
  }
}
