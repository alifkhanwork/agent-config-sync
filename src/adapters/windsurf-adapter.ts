import os from 'os';
import path from 'path';
import fs from 'fs';
import { BaseAdapter } from './base-adapter';
import { CanonicalConfig, SyncOptions, AdapterResult, DriftStatus } from '../core/types';
import { createBackup } from '../core/backup';
import { maskSecret } from '../core/secret-masker';

export class WindsurfAdapter extends BaseAdapter {
  readonly id = 'windsurf';
  readonly name = 'Windsurf IDE';

  public getConfigPath(overridePath?: string): string {
    if (overridePath) return overridePath;

    const platform = os.platform();
    const home = os.homedir();

    if (platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', 'Windsurf', 'User', 'settings.json');
    } else if (platform === 'win32') {
      const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
      return path.join(appData, 'Windsurf', 'User', 'settings.json');
    } else {
      return path.join(home, '.config', 'Windsurf', 'User', 'settings.json');
    }
  }

  public getMcpConfigPath(): string {
    return path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json');
  }

  public async isInstalled(): Promise<boolean> {
    const mainPath = this.getConfigPath();
    const windsurfDir = path.dirname(mainPath);
    const mcpDir = path.dirname(this.getMcpConfigPath());
    return fs.existsSync(windsurfDir) || fs.existsSync(mcpDir);
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

    const defaultModel = centralConfig.defaults.defaultModel;
    if (defaultModel && updatedConfig['windsurf.model'] !== defaultModel) {
      updatedConfig['windsurf.model'] = defaultModel;
      changes.push(`Set windsurf.model to "${defaultModel}"`);
    }

    if (!updatedConfig['windsurf.apiKeys']) {
      updatedConfig['windsurf.apiKeys'] = {};
    }

    for (const [provider, key] of Object.entries(secrets)) {
      if (!key) continue;
      if (updatedConfig['windsurf.apiKeys'][provider] !== key) {
        updatedConfig['windsurf.apiKeys'][provider] = key;
        changes.push(`Set windsurf.apiKeys.${provider} (${maskSecret(key)})`);
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

    const apiKeys = currentConfig['windsurf.apiKeys'] || {};
    if (secrets.anthropic && apiKeys.anthropic !== secrets.anthropic) {
      drifted = true;
      reason = 'Anthropic key mismatch in Windsurf settings';
    }

    return { toolId: this.id, toolName: this.name, installed, configPath: filePath, exists, drifted, reason };
  }
}
