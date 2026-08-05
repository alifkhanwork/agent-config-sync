import os from 'os';
import path from 'path';
import fs from 'fs';
import { BaseAdapter } from './base-adapter';
import { CanonicalConfig, SyncOptions, AdapterResult, DriftStatus } from '../core/types';
import { createBackup } from '../core/backup';
import { maskSecret } from '../core/secret-masker';

export class ClaudeCodeAdapter extends BaseAdapter {
  readonly id = 'claude-code';
  readonly name = 'Claude Code CLI';

  public getConfigPath(overridePath?: string): string {
    if (overridePath) return overridePath;
    return path.join(os.homedir(), '.claude', 'settings.json');
  }

  public getMcpConfigPath(): string {
    return path.join(os.homedir(), '.claude.json');
  }

  public async isInstalled(): Promise<boolean> {
    const mainDir = path.dirname(this.getConfigPath());
    const mcpFile = this.getMcpConfigPath();
    return fs.existsSync(mainDir) || fs.existsSync(mcpFile);
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

    const anthropicKey = secrets.anthropic || secrets.primary;

    if (anthropicKey) {
      if (!updatedConfig.env) updatedConfig.env = {};
      if (updatedConfig.env.ANTHROPIC_API_KEY !== anthropicKey) {
        updatedConfig.env.ANTHROPIC_API_KEY = anthropicKey;
        changes.push(`Set env.ANTHROPIC_API_KEY (${maskSecret(anthropicKey)})`);
      }
    }

    const defaultModel = centralConfig.defaults.defaultModel;
    if (defaultModel && updatedConfig.model !== defaultModel) {
      updatedConfig.model = defaultModel;
      changes.push(`Set model to "${defaultModel}"`);
    }

    // Sync primaryApiKey in ~/.claude.json as well if needed
    const mcpPath = this.getMcpConfigPath();
    let mcpUpdated = false;
    let mcpConfig: Record<string, any> = {};
    if (anthropicKey && fs.existsSync(mcpPath)) {
      try {
        mcpConfig = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
        if (mcpConfig.primaryApiKey !== anthropicKey) {
          mcpConfig.primaryApiKey = anthropicKey;
          mcpUpdated = true;
          changes.push(`Set primaryApiKey in ~/.claude.json (${maskSecret(anthropicKey)})`);
        }
      } catch {
        // Ignore
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

    // Backup & write main settings
    await createBackup(filePath);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(updatedConfig, null, 2), 'utf8');

    // Backup & write MCP config if updated
    if (mcpUpdated) {
      await createBackup(mcpPath);
      fs.writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2), 'utf8');
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

    const anthropicKey = secrets.anthropic || secrets.primary;
    if (anthropicKey && currentConfig.env?.ANTHROPIC_API_KEY !== anthropicKey) {
      drifted = true;
      reason = 'Anthropic API key mismatch';
    }

    return { toolId: this.id, toolName: this.name, installed, configPath: filePath, exists, drifted, reason };
  }
}
