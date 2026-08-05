import os from 'os';
import path from 'path';
import fs from 'fs';
import { BaseAdapter } from './base-adapter';
import { CanonicalConfig, SyncOptions, AdapterResult, DriftStatus } from '../core/types';
import { createBackup } from '../core/backup';
import { maskSecret } from '../core/secret-masker';

export class CursorAdapter extends BaseAdapter {
  readonly id = 'cursor';
  readonly name = 'Cursor IDE';

  public getConfigPath(overridePath?: string): string {
    if (overridePath) return overridePath;

    const platform = os.platform();
    const home = os.homedir();

    if (platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'settings.json');
    } else if (platform === 'win32') {
      const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
      return path.join(appData, 'Cursor', 'User', 'settings.json');
    } else {
      return path.join(home, '.config', 'Cursor', 'User', 'settings.json');
    }
  }

  public async isInstalled(): Promise<boolean> {
    const filePath = this.getConfigPath();
    const cursorDir = path.dirname(filePath);
    return fs.existsSync(cursorDir);
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

    const openaiKey = secrets.openai;
    const anthropicKey = secrets.anthropic;

    if (openaiKey) {
      if (currentConfig['cursor.general.openaiApiKey'] !== openaiKey) {
        updatedConfig['cursor.general.openaiApiKey'] = openaiKey;
        changes.push(`Set cursor.general.openaiApiKey (${maskSecret(openaiKey)})`);
      }
    }

    if (anthropicKey) {
      if (currentConfig['cursor.general.anthropicApiKey'] !== anthropicKey) {
        updatedConfig['cursor.general.anthropicApiKey'] = anthropicKey;
        changes.push(`Set cursor.general.anthropicApiKey (${maskSecret(anthropicKey)})`);
      }
    }

    const defaultModel = centralConfig.defaults.defaultModel;
    if (defaultModel && currentConfig['cursor.ai.model'] !== defaultModel) {
      updatedConfig['cursor.ai.model'] = defaultModel;
      changes.push(`Set cursor.ai.model to "${defaultModel}"`);
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

    // Write changes with backup
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

    if (secrets.anthropic && currentConfig['cursor.general.anthropicApiKey'] !== secrets.anthropic) {
      drifted = true;
      reason = 'Anthropic API key mismatch';
    }
    if (secrets.openai && currentConfig['cursor.general.openaiApiKey'] !== secrets.openai) {
      drifted = true;
      reason = reason ? `${reason}, OpenAI API key mismatch` : 'OpenAI API key mismatch';
    }

    return { toolId: this.id, toolName: this.name, installed, configPath: filePath, exists, drifted, reason };
  }
}
