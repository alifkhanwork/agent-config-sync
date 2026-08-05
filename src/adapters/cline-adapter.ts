import os from 'os';
import path from 'path';
import fs from 'fs';
import { BaseAdapter } from './base-adapter';
import { CanonicalConfig, SyncOptions, AdapterResult, DriftStatus } from '../core/types';
import { createBackup } from '../core/backup';
import { maskSecret } from '../core/secret-masker';

export class ClineAdapter extends BaseAdapter {
  readonly id = 'cline';
  readonly name = 'Cline Extension';

  public getConfigPath(overridePath?: string): string {
    if (overridePath) return overridePath;
    return path.join(os.homedir(), '.cline', 'data', 'settings', 'providers.json');
  }

  public async isInstalled(): Promise<boolean> {
    const clineDir = path.join(os.homedir(), '.cline');
    return fs.existsSync(clineDir);
  }

  public async readConfig(overridePath?: string): Promise<Record<string, any>> {
    const filePath = this.getConfigPath(overridePath);
    if (!fs.existsSync(filePath)) {
      return {};
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
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
    const updatedConfig = { ...currentConfig };

    for (const [provider, key] of Object.entries(secrets)) {
      if (!key) continue;
      if (!updatedConfig[provider]) {
        updatedConfig[provider] = {};
      }
      if (updatedConfig[provider].apiKey !== key) {
        updatedConfig[provider].apiKey = key;
        changes.push(`Set ${provider}.apiKey (${maskSecret(key)})`);
      }
    }

    const primaryProvider = centralConfig.defaults.primaryProvider;
    if (primaryProvider && updatedConfig.apiProvider !== primaryProvider) {
      updatedConfig.apiProvider = primaryProvider;
      changes.push(`Set apiProvider to "${primaryProvider}"`);
    }

    const defaultModel = centralConfig.defaults.defaultModel;
    if (defaultModel && updatedConfig.apiModelId !== defaultModel) {
      updatedConfig.apiModelId = defaultModel;
      changes.push(`Set apiModelId to "${defaultModel}"`);
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

    fs.writeFileSync(filePath, JSON.stringify(updatedConfig, null, 2), 'utf8');

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

    if (secrets.anthropic && currentConfig.anthropic?.apiKey !== secrets.anthropic) {
      drifted = true;
      reason = 'Anthropic key mismatch';
    }
    if (secrets.openai && currentConfig.openai?.apiKey !== secrets.openai) {
      drifted = true;
      reason = reason ? `${reason}, OpenAI key mismatch` : 'OpenAI key mismatch';
    }

    return { toolId: this.id, toolName: this.name, installed, configPath: filePath, exists, drifted, reason };
  }
}
