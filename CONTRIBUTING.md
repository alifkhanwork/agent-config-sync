# Contributing to `agent-config-sync`

Thank you for contributing to `agent-config-sync`! We welcome bug fixes, documentation updates, and support for new AI coding tools.

---

## 🛠 Adding a New Tool Adapter

`agent-config-sync` uses a pluggable adapter architecture. Adding support for a new AI coding agent tool takes just a few steps:

### Step 1: Create a new adapter class in `src/adapters/`

Create a new file e.g. `src/adapters/my-tool-adapter.ts`:

```ts
import os from 'os';
import path from 'path';
import fs from 'fs';
import { BaseAdapter } from './base-adapter';
import { CanonicalConfig, SyncOptions, AdapterResult, DriftStatus } from '../core/types';
import { createBackup } from '../core/backup';
import { maskSecret } from '../core/secret-masker';

export class MyToolAdapter extends BaseAdapter {
  readonly id = 'my-tool';
  readonly name = 'My Tool Name';

  public getConfigPath(overridePath?: string): string {
    if (overridePath) return overridePath;
    // Resolve native config file location per OS
    return path.join(os.homedir(), '.my-tool', 'config.json');
  }

  public async isInstalled(): Promise<boolean> {
    const configPath = this.getConfigPath();
    return fs.existsSync(path.dirname(configPath));
  }

  public async readConfig(overridePath?: string): Promise<Record<string, any>> {
    const filePath = this.getConfigPath(overridePath);
    if (!fs.existsSync(filePath)) return {};
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

    // Update keys non-destructively
    if (secrets.anthropic && updatedConfig.apiKey !== secrets.anthropic) {
      updatedConfig.apiKey = secrets.anthropic;
      changes.push(`Set apiKey (${maskSecret(secrets.anthropic)})`);
    }

    if (changes.length === 0) {
      return { toolId: this.id, toolName: this.name, success: true, filePath, action: 'unchanged', changes: [] };
    }

    if (options.dryRun) {
      return { toolId: this.id, toolName: this.name, success: true, filePath, action: 'updated', changes };
    }

    // Create timestamped backup and write updated config
    await createBackup(filePath);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(updatedConfig, null, 2), 'utf8');

    return { toolId: this.id, toolName: this.name, success: true, filePath, action: 'updated', changes };
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

    if (secrets.anthropic && currentConfig.apiKey !== secrets.anthropic) {
      drifted = true;
      reason = 'API key mismatch';
    }

    return { toolId: this.id, toolName: this.name, installed, configPath: filePath, exists, drifted, reason };
  }
}
```

### Step 2: Register in `src/adapters/index.ts`

Add your adapter to `getAllAdapters()` in `src/adapters/index.ts`:

```ts
import { MyToolAdapter } from './my-tool-adapter';

export function getAllAdapters(): BaseAdapter[] {
  return [
    new CursorAdapter(),
    new ClaudeCodeAdapter(),
    new ClineAdapter(),
    new CodexCLIAdapter(),
    new WindsurfAdapter(),
    new ContinueAdapter(),
    new MyToolAdapter(), // <--- Add your adapter here
  ];
}
```

### Step 3: Add unit tests in `tests/adapters/adapters.test.ts`

Add an end-to-end test validating `isInstalled()`, `sync()`, backup creation, and drift checking for your adapter.

### Step 4: Run verification

```bash
npm run typecheck
npm run test
npm run build
```

Submit a Pull Request with your adapter!
