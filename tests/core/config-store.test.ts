import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { ConfigStore } from '../../src/core/config-store';

describe('ConfigStore', () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-test-'));
    configPath = path.join(tmpDir, 'config.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should initialize default config if store does not exist', () => {
    const store = new ConfigStore(configPath);
    expect(store.exists()).toBe(false);
    const config = store.read();
    expect(config.version).toBe('1.0.0');
    expect(config.defaults.primaryProvider).toBe('anthropic');
  });

  it('should write and read back central config', () => {
    const store = new ConfigStore(configPath);
    const config = store.getDefaultConfig();
    config.providers.openai = {
      keychainRef: 'agent-config-sync:openai',
      defaultModel: 'gpt-4o',
    };

    store.write(config);
    expect(store.exists()).toBe(true);

    const reloaded = store.read();
    expect(reloaded.providers.openai.defaultModel).toBe('gpt-4o');
  });

  it('should merge project-level overrides from .agent-config.json', () => {
    const store = new ConfigStore(configPath);
    const config = store.getDefaultConfig();
    store.write(config);

    const projectDir = path.join(tmpDir, 'my-project');
    fs.mkdirSync(projectDir);
    fs.writeFileSync(
      path.join(projectDir, '.agent-config.json'),
      JSON.stringify({
        defaults: { defaultModel: 'claude-3-5-haiku-20241022' },
      })
    );

    const merged = store.read(projectDir);
    expect(merged.defaults.defaultModel).toBe('claude-3-5-haiku-20241022');
  });
});
