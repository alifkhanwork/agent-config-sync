import crypto from 'crypto';
import { CanonicalConfig, SyncOptions, AdapterResult, DriftStatus } from '../core/types';

export abstract class BaseAdapter {
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
  abstract sync(
    centralConfig: CanonicalConfig,
    secrets: Record<string, string>,
    options: SyncOptions
  ): Promise<AdapterResult>;

  /**
   * Checks if the native config has drifted from the central config or last synced state.
   */
  abstract checkDrift(
    centralConfig: CanonicalConfig,
    secrets: Record<string, string>
  ): Promise<DriftStatus>;

  /**
   * Computes SHA-256 hash of configuration content string.
   */
  protected computeHash(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }
}
