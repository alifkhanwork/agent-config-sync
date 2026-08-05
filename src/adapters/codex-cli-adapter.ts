import os from 'os';
import path from 'path';
import fs from 'fs';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { BaseAdapter } from './base-adapter';
import { CanonicalConfig, SyncOptions, AdapterResult, DriftStatus } from '../core/types';
import { createBackup } from '../core/backup';
import { maskSecret } from '../core/secret-masker';

export class CodexCLIAdapter extends BaseAdapter {
  readonly id = 'codex';
  readonly name = 'Codex CLI';

  public getConfigPath(overridePath?: string): string {
    if (overridePath) return overridePath;
    const home = os.homedir();
    return path.join(home, '.codex', 'config.toml');
  }

  public async isInstalled(): Promise<boolean> {
    const codexDir = path.join(os.homedir(), '.codex');
    return fs.existsSync(codexDir);
  }

  public async readConfig(overridePath?: string): Promise<Record<string, any>> {
    const filePath = this.getConfigPath(overridePath);
    if (!fs.existsSync(filePath)) {
      return {};
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return parseToml(raw) as Record<string, any>;
    } catch {
      return {};
    }
  }

  public async sync(
    centralConfig: CanonicalConfig,
    secrets: Record<string, string>,
    options: SyncOptions
  ): Promise<AdapterResult> {
    const filePath = this.getConfigPath(centralConfig.tools[this.id]?.customConfigPath);
    const changes: string[] = [];

    const currentConfig = await this.readConfig(filePath);
    const updatedConfig: Record<string, any> = { ...currentConfig };

    const defaultModel = centralConfig.defaults.defaultModel;
    if (defaultModel && updatedConfig.model !== defaultModel) {
      updatedConfig.model = defaultModel;
      changes.push(`Set model = "${defaultModel}"`);
    }

    const primaryProvider = centralConfig.defaults.primaryProvider;
    if (primaryProvider && updatedConfig.model_provider !== primaryProvider) {
      updatedConfig.model_provider = primaryProvider;
      changes.push(`Set model_provider = "${primaryProvider}"`);
    }

    // Write keys under [api_keys] block
    if (!updatedConfig.api_keys) {
      updatedConfig.api_keys = {};
    }

    for (const [provider, key] of Object.entries(secrets)) {
      if (!key) continue;
      if (updatedConfig.api_keys[provider] !== key) {
        updatedConfig.api_keys[provider] = key;
        changes.push(`Set api_keys.${provider} (${maskSecret(key)})`);
      }
    }

    if (changes.length === 0) {
      return {
        toolId: this.id,
        toolName: this.name,
        success: true,
        filePath,
        action: 'unchanged',
        changes: [],
      };
    }

    if (options.dryRun) {
      return {
        toolId: this.id,
        toolName: this.name,
        success: true,
        filePath,
        action: 'updated',
        changes,
      };
    }

    await createBackup(filePath);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const tomlContent = stringifyToml(updatedConfig);
    fs.writeFileSync(filePath, tomlContent, 'utf8');

    return {
      toolId: this.id,
      toolName: this.name,
      success: true,
      filePath,
      action: fs.existsSync(filePath) ? 'updated' : 'created',
      changes,
    };
  }

  public async checkDrift(
    centralConfig: CanonicalConfig,
    secrets: Record<string, string>
  ): Promise<DriftStatus> {
    const filePath = this.getConfigPath(centralConfig.tools[this.id]?.customConfigPath);
    const installed = await this.isInstalled();
    const exists = fs.existsSync(filePath);

    if (!exists) {
      return { toolId: this.id, toolName: this.name, installed, configPath: filePath, exists, drifted: false };
    }

    const currentConfig = await this.readConfig(filePath);
    let drifted = false;
    let reason = '';

    const apiKeys = currentConfig.api_keys || {};
    if (secrets.openai && apiKeys.openai !== secrets.openai) {
      drifted = true;
      reason = 'OpenAI API key mismatch in TOML';
    }

    return { toolId: this.id, toolName: this.name, installed, configPath: filePath, exists, drifted, reason };
  }
}
