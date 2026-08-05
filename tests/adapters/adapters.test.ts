import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { CursorAdapter } from '../../src/adapters/cursor-adapter';
import { ClaudeCodeAdapter } from '../../src/adapters/claude-code-adapter';
import { ClineAdapter } from '../../src/adapters/cline-adapter';
import { CodexCLIAdapter } from '../../src/adapters/codex-cli-adapter';
import { WindsurfAdapter } from '../../src/adapters/windsurf-adapter';
import { ContinueAdapter } from '../../src/adapters/continue-adapter';
import { CanonicalConfig } from '../../src/core/types';

describe('Adapters End-to-End Test Suite', () => {
  let tmpDir: string;
  let sampleConfig: CanonicalConfig;
  let sampleSecrets: Record<string, string>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-adapters-test-'));

    sampleConfig = {
      version: '1.0.0',
      providers: {
        anthropic: { keychainRef: 'agent-config-sync:anthropic', defaultModel: 'claude-3-7-sonnet-20250219' },
        openai: { keychainRef: 'agent-config-sync:openai', defaultModel: 'gpt-4o' },
      },
      defaults: {
        primaryProvider: 'anthropic',
        defaultModel: 'claude-3-7-sonnet-20250219',
      },
      syncTargets: { cursor: true, 'claude-code': true, cline: true, codex: true, windsurf: true, 'continue-dev': true },
      tools: {},
    };

    sampleSecrets = {
      anthropic: 'sk-ant-test-key-12345678',
      openai: 'sk-proj-test-key-87654321',
    };
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('CursorAdapter: syncs API keys and model to Cursor settings.json and creates backup', async () => {
    const targetFile = path.join(tmpDir, 'cursor-settings.json');
    fs.writeFileSync(targetFile, JSON.stringify({ 'cursor.cpp.disabledLanguages': ['c'] }), 'utf8');

    sampleConfig.tools['cursor'] = { enabled: true, customConfigPath: targetFile };

    const adapter = new CursorAdapter();
    const result = await adapter.sync(sampleConfig, sampleSecrets, { dryRun: false, tools: ['cursor'] });

    expect(result.success).toBe(true);
    expect(result.action).toBe('updated');

    const updated = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
    expect(updated['cursor.general.openaiApiKey']).toBe(sampleSecrets.openai);
    expect(updated['cursor.general.anthropicApiKey']).toBe(sampleSecrets.anthropic);
    expect(updated['cursor.ai.model']).toBe('claude-3-7-sonnet-20250219');
    expect(updated['cursor.cpp.disabledLanguages']).toEqual(['c']);

    // Check backup creation
    const files = fs.readdirSync(tmpDir);
    expect(files.some((f) => f.includes('.bak'))).toBe(true);
  });

  it('ClaudeCodeAdapter: syncs env ANTHROPIC_API_KEY to Claude settings.json', async () => {
    const targetFile = path.join(tmpDir, 'claude-settings.json');
    const adapter = new ClaudeCodeAdapter();

    // Use overridePath by customizing tool config path in sampleConfig
    sampleConfig.tools['claude-code'] = { enabled: true, customConfigPath: targetFile };

    const result = await adapter.sync(sampleConfig, sampleSecrets, { dryRun: false });
    expect(result.success).toBe(true);

    const updated = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
    expect(updated.env.ANTHROPIC_API_KEY).toBe(sampleSecrets.anthropic);
    expect(updated.model).toBe('claude-3-7-sonnet-20250219');
  });

  it('ClineAdapter: syncs keys into providers.json', async () => {
    const targetFile = path.join(tmpDir, 'providers.json');
    const adapter = new ClineAdapter();

    sampleConfig.tools['cline'] = { enabled: true, customConfigPath: targetFile };

    const result = await adapter.sync(sampleConfig, sampleSecrets, { dryRun: false });
    expect(result.success).toBe(true);

    const updated = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
    expect(updated.anthropic.apiKey).toBe(sampleSecrets.anthropic);
    expect(updated.openai.apiKey).toBe(sampleSecrets.openai);
    expect(updated.apiProvider).toBe('anthropic');
  });

  it('CodexCLIAdapter: syncs to TOML configuration', async () => {
    const targetFile = path.join(tmpDir, 'config.toml');
    const adapter = new CodexCLIAdapter();

    sampleConfig.tools['codex'] = { enabled: true, customConfigPath: targetFile };

    const result = await adapter.sync(sampleConfig, sampleSecrets, { dryRun: false });
    expect(result.success).toBe(true);

    const rawToml = fs.readFileSync(targetFile, 'utf8');
    expect(rawToml).toContain('model = "claude-3-7-sonnet-20250219"');
    expect(rawToml).toContain('anthropic = "sk-ant-test-key-12345678"');
  });

  it('WindsurfAdapter: syncs model and apiKeys to Windsurf settings.json', async () => {
    const targetFile = path.join(tmpDir, 'windsurf-settings.json');
    const adapter = new WindsurfAdapter();

    sampleConfig.tools['windsurf'] = { enabled: true, customConfigPath: targetFile };

    const result = await adapter.sync(sampleConfig, sampleSecrets, { dryRun: false });
    expect(result.success).toBe(true);

    const updated = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
    expect(updated['windsurf.model']).toBe('claude-3-7-sonnet-20250219');
    expect(updated['windsurf.apiKeys'].anthropic).toBe(sampleSecrets.anthropic);
  });

  it('ContinueAdapter: syncs models into config.yaml', async () => {
    const targetFile = path.join(tmpDir, 'continue-config.yaml');
    const adapter = new ContinueAdapter();

    sampleConfig.tools['continue-dev'] = { enabled: true, customConfigPath: targetFile };

    const result = await adapter.sync(sampleConfig, sampleSecrets, { dryRun: false });
    expect(result.success).toBe(true);

    const rawYaml = fs.readFileSync(targetFile, 'utf8');
    expect(rawYaml).toContain('provider: anthropic');
    expect(rawYaml).toContain('sk-ant-test-key-12345678');
  });

  it('Dry-Run Mode: does not write files on disk', async () => {
    const targetFile = path.join(tmpDir, 'non-existent-settings.json');
    const adapter = new CursorAdapter();

    sampleConfig.tools['cursor'] = { enabled: true, customConfigPath: targetFile };

    const result = await adapter.sync(sampleConfig, sampleSecrets, { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.action).toBe('updated');
    expect(fs.existsSync(targetFile)).toBe(false);
  });
});
