import os from 'os';
import path from 'path';
import fs from 'fs';
import { CanonicalConfig, ProviderConfig, ToolOverride } from './types';

export class ConfigStore {
  private configPath: string;

  constructor(customPath?: string) {
    if (customPath) {
      this.configPath = customPath;
    } else {
      const baseDir = path.join(os.homedir(), '.agent-config');
      this.configPath = path.join(baseDir, 'config.json');
    }
  }

  public getConfigPath(): string {
    return this.configPath;
  }

  public exists(): boolean {
    return fs.existsSync(this.configPath);
  }

  public getDefaultConfig(): CanonicalConfig {
    return {
      version: '1.0.0',
      providers: {},
      defaults: {
        primaryProvider: 'anthropic',
        defaultModel: 'claude-3-7-sonnet-20250219',
      },
      syncTargets: {
        cursor: true,
        'claude-code': true,
        cline: true,
        codex: true,
        windsurf: true,
        'continue-dev': true,
      },
      tools: {},
      hashes: {},
    };
  }

  public read(projectPath?: string): CanonicalConfig {
    let config = this.getDefaultConfig();

    if (this.exists()) {
      try {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        const parsed = JSON.parse(raw);
        config = {
          ...config,
          ...parsed,
          providers: { ...config.providers, ...parsed.providers },
          defaults: { ...config.defaults, ...parsed.defaults },
          syncTargets: { ...config.syncTargets, ...parsed.syncTargets },
          tools: { ...config.tools, ...parsed.tools },
          hashes: { ...config.hashes, ...parsed.hashes },
        };
      } catch (err) {
        throw new Error(`Failed to parse central config at ${this.configPath}: ${(err as Error).message}`);
      }
    }

    // Merge project-level override if exists (.agent-config.json)
    if (projectPath) {
      const projectConfigPath = path.join(projectPath, '.agent-config.json');
      if (fs.existsSync(projectConfigPath)) {
        try {
          const projectRaw = fs.readFileSync(projectConfigPath, 'utf8');
          const projectParsed = JSON.parse(projectRaw);
          config = this.mergeConfig(config, projectParsed);
        } catch {
          // Ignore invalid project config or log warning
        }
      }
    }

    return config;
  }

  public write(config: CanonicalConfig): void {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), { encoding: 'utf8' });
  }

  public setProvider(provider: string, config: ProviderConfig): void {
    const current = this.read();
    current.providers[provider] = config;
    this.write(current);
  }

  public removeProvider(provider: string): void {
    const current = this.read();
    delete current.providers[provider];
    this.write(current);
  }

  public setSyncTarget(toolId: string, enabled: boolean): void {
    const current = this.read();
    current.syncTargets[toolId] = enabled;
    this.write(current);
  }

  public setToolOverride(toolId: string, override: ToolOverride): void {
    const current = this.read();
    current.tools[toolId] = override;
    this.write(current);
  }

  public updateHashes(hashes: Record<string, string>): void {
    const current = this.read();
    current.hashes = { ...current.hashes, ...hashes };
    current.lastSyncedAt = new Date().toISOString();
    this.write(current);
  }

  private mergeConfig(base: CanonicalConfig, override: Partial<CanonicalConfig>): CanonicalConfig {
    return {
      ...base,
      ...override,
      providers: { ...base.providers, ...override.providers },
      defaults: { ...base.defaults, ...override.defaults },
      syncTargets: { ...base.syncTargets, ...override.syncTargets },
      tools: { ...base.tools, ...override.tools },
    };
  }
}
