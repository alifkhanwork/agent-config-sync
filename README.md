# `@svgph/agent-config-sync` 🚀

> **Single source of truth for AI coding agent configuration** — API keys, default models, and tool settings — synchronized automatically to native configurations used by **Cursor**, **Claude Code**, **Cline**, **Codex CLI**, **Windsurf**, and **Continue.dev**.

---

## 💡 Why `agent-config-sync`?

Developers currently re-enter the same API keys and model preferences separately into every AI coding agent tool they use. When an API key rotates or a model preference changes, updating it manually across 4–5 different tools is tedious and error-prone.

`agent-config-sync` centralizes your AI agent setup into one canonical store, backed by your **OS Keychain**, and automatically pushes configurations out to each tool's native format and location.

---

## 🔑 Security First

`agent-config-sync` handles sensitive API keys with zero-compromise security defaults:

1. **OS Keychain Credentials**: API keys are saved directly into your system's native keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service via `keytar`).
2. **No Plaintext Secrets in Config Files**: The canonical central store (`~/.agent-config/config.json`) only contains keychain reference IDs (e.g. `agent-config-sync:anthropic`), never raw API keys.
3. **Encrypted Fallback Vault**: In CI/headless environments where native keychains are unavailable, `agent-config-sync` automatically uses an AES-256-GCM encrypted local vault.
4. **Secret Redaction**: Raw keys are automatically masked across all CLI logs, dry-run diffs, status tables, and diagnostic outputs (e.g., `sk-ant-***1234`).
5. **Non-Destructive Deep Merge**: Native tool config files (like `settings.json` or `config.toml`) are merged safely, preserving all your custom themes, keybindings, and unrelated settings.
6. **Automatic Backups**: Creates a timestamped `.bak` copy of target configuration files prior to performing any write operation.

---

## 📊 Supported Tools Matrix

| Tool | Config Location | Format | Managed Settings |
| :--- | :--- | :--- | :--- |
| **Cursor** | `~/Library/Application Support/Cursor/User/settings.json` (macOS)<br>`%APPDATA%\Cursor\User\settings.json` (Win) | JSON | `cursor.general.openaiApiKey`<br>`cursor.general.anthropicApiKey`<br>`cursor.ai.model` |
| **Claude Code** | `~/.claude/settings.json` & `~/.claude.json` | JSON | `env.ANTHROPIC_API_KEY`<br>`model`<br>`primaryApiKey` |
| **Cline** | `~/.cline/data/settings/providers.json` | JSON | `anthropic.apiKey`<br>`openai.apiKey`<br>`apiProvider`<br>`apiModelId` |
| **Codex CLI** | `~/.codex/config.toml` | TOML | `model`<br>`model_provider`<br>`[api_keys]` block |
| **Windsurf** | `~/Library/Application Support/Windsurf/User/settings.json`<br>`~/.codeium/windsurf/mcp_config.json` | JSON | `windsurf.model`<br>`windsurf.apiKeys` |
| **Continue.dev** | `~/.continue/config.yaml` (or `config.json`) | YAML / JSON | `models` array with provider credentials & default model selections |

---

## 📦 Installation

```bash
# Global installation via npm
npm install -g @svgph/agent-config-sync

# Or run directly with npx
npx @svgph/agent-config-sync --help
```

---

## 🛠 CLI Usage Reference

### 1. Interactive Setup (`agent-config init`)
Detects installed tools on your system automatically and configures your primary AI provider:
```bash
agent-config init
```

### 2. Add / Update API Key (`agent-config add`)
Securely prompts for an API key (input masked) and stores it in your OS Keychain:
```bash
agent-config add anthropic
agent-config add openai
```

### 3. Synchronize Config (`agent-config sync`)
Pushes your central config to all detected native tool configs:
```bash
# Preview what would change without modifying files
agent-config sync --dry-run

# Perform real synchronization with automatic backups
agent-config sync

# Sync specific tools only
agent-config sync --tools cursor,cline

# Include project-scoped overrides from local .agent-config.json
agent-config sync --project
```

### 4. Status & Drift Detection (`agent-config status`)
Shows stored providers, keychain status, detected tools, and warns if any tool config was edited manually since last sync:
```bash
agent-config status
```

### 5. Diagnostic Health Check (`agent-config doctor`)
Validates keychain access, checks key formats, and verifies file write permissions:
```bash
agent-config doctor
```

### 6. Auto-Resync Watcher (`agent-config watch`)
Runs a background daemon watching `~/.agent-config/config.json` and auto-resyncs on file changes:
```bash
agent-config watch
```

### 7. Encrypted Export & Import (`agent-config export` / `import`)
Transfer configuration securely between machines using password-protected AES-256-GCM encryption:
```bash
# Export encrypted bundle
agent-config export my-backup.enc

# Import encrypted bundle on a new machine
agent-config import my-backup.enc
```

---

## 💻 Library Usage (TypeScript)

You can also use `agent-config-sync` programmatically in Node.js applications:

```ts
import { ConfigStore, SyncEngine, KeychainManager } from '@svgph/agent-config-sync';

const configStore = new ConfigStore();
const keychain = new KeychainManager();
const syncEngine = new SyncEngine(configStore, keychain);

// Add API Key to OS Keychain
const keychainRef = await keychain.setSecret('anthropic', 'sk-ant-api03-xxx');

// Save central config
configStore.setProvider('anthropic', {
  keychainRef,
  defaultModel: 'claude-3-7-sonnet-20250219',
});

// Run synchronization
const results = await syncEngine.sync({ dryRun: false });
console.log(results);
```

---

## 🤝 Contributing

We welcome contributions! Read [CONTRIBUTING.md](./CONTRIBUTING.md) to learn how to implement a new tool adapter in under 50 lines of code.

---

## 📄 License

[MIT](./LICENSE) © SVG Team
