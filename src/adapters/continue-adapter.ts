import os from 'os';
import path from 'path';
import fs from 'fs';
import YAML from 'yaml';
import { BaseAdapter } from './base-adapter';
import { CanonicalConfig, SyncOptions, AdapterResult, DriftStatus } from '../core/types';
import { createBackup } from '../core/backup';
import { maskSecret } from '../core/secret-masker';

export class ContinueAdapter extends BaseAdapter {
  readonly id = 'continue-dev';
  readonly name = 'Continue.dev';

  public getConfigPath(overridePath?: string): string {
    if (overridePath) return overridePath;
    const home = os.homedir();
    const yamlPath = path.join(home, '.continue', 'config.yaml');
    const jsonPath = path.join(home, '.continue', 'config.json');

    if (fs.existsSync(jsonPath) && !fs.existsSync(yamlPath)) {
      return jsonPath;
    }
    return yamlPath;
  }

  public async isInstalled(): Promise<boolean> {
    const continueDir = path.join(os.homedir(), '.continue');
    return fs.existsSync(continueDir);
  }

  public async readConfig(overridePath?: string): Promise<Record<string, any>> {
    const filePath = this.getConfigPath(overridePath);
    if (!fs.existsSync(filePath)) {
      return {};
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      if (filePath.endsWith('.json')) {
        return JSON.parse(raw);
      } else {
        return YAML.parse(raw) || {};
      }
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

    if (!Array.isArray(updatedConfig.models)) {
      updatedConfig.models = [];
    }

    for (const [provider, key] of Object.entries(secrets)) {
      if (!key) continue;
      const modelName = centralConfig.providers[provider]?.defaultModel || centralConfig.defaults.defaultModel || `${provider}-default`;
      
      const existingModelIdx = updatedConfig.models.findIndex(
        (m: any) => m && (m.provider === provider || m.name === modelName)
      );

      if (existingModelIdx >= 0) {
        const existing = updatedConfig.models[existingModelIdx];
        if (existing.apiKey !== key || existing.model !== modelName) {
          updatedConfig.models[existingModelIdx] = {
            ...existing,
            provider,
            model: modelName,
            apiKey: key,
          };
          changes.push(`Updated Continue model entry for "${provider}" (${maskSecret(key)})`);
        }
      } else {
        updatedConfig.models.push({
          name: modelName,
          provider,
          model: modelName,
          apiKey: key,
          roles: ['chat', 'edit'],
        });
        changes.push(`Added Continue model entry for "${provider}" (${maskSecret(key)})`);
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

    if (filePath.endsWith('.json')) {
      fs.writeFileSync(filePath, JSON.stringify(updatedConfig, null, 2), 'utf8');
    } else {
      fs.writeFileSync(filePath, YAML.stringify(updatedConfig), 'utf8');
    }

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

    const models = Array.isArray(currentConfig.models) ? currentConfig.models : [];
    if (secrets.anthropic) {
      const anthropicModel = models.find((m: any) => m && m.provider === 'anthropic');
      if (!anthropicModel || anthropicModel.apiKey !== secrets.anthropic) {
        drifted = true;
        reason = 'Anthropic model apiKey mismatch in Continue config';
      }
    }

    return { toolId: this.id, toolName: this.name, installed, configPath: filePath, exists, drifted, reason };
  }
}
