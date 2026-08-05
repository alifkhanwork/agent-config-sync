"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/cli/index.ts
var import_commander = require("commander");

// src/cli/commands/init.ts
var import_prompts = __toESM(require("prompts"));

// src/core/config-store.ts
var import_os = __toESM(require("os"));
var import_path = __toESM(require("path"));
var import_fs = __toESM(require("fs"));
var ConfigStore = class {
  configPath;
  constructor(customPath) {
    if (customPath) {
      this.configPath = customPath;
    } else {
      const baseDir = import_path.default.join(import_os.default.homedir(), ".agent-config");
      this.configPath = import_path.default.join(baseDir, "config.json");
    }
  }
  getConfigPath() {
    return this.configPath;
  }
  exists() {
    return import_fs.default.existsSync(this.configPath);
  }
  getDefaultConfig() {
    return {
      version: "1.0.0",
      providers: {},
      defaults: {
        primaryProvider: "anthropic",
        defaultModel: "claude-3-7-sonnet-20250219"
      },
      syncTargets: {
        cursor: true,
        "claude-code": true,
        cline: true,
        codex: true,
        windsurf: true,
        "continue-dev": true
      },
      tools: {},
      hashes: {}
    };
  }
  read(projectPath) {
    let config = this.getDefaultConfig();
    if (this.exists()) {
      try {
        const raw = import_fs.default.readFileSync(this.configPath, "utf8");
        const parsed = JSON.parse(raw);
        config = {
          ...config,
          ...parsed,
          providers: { ...config.providers, ...parsed.providers },
          defaults: { ...config.defaults, ...parsed.defaults },
          syncTargets: { ...config.syncTargets, ...parsed.syncTargets },
          tools: { ...config.tools, ...parsed.tools },
          hashes: { ...config.hashes, ...parsed.hashes }
        };
      } catch (err) {
        throw new Error(`Failed to parse central config at ${this.configPath}: ${err.message}`);
      }
    }
    if (projectPath) {
      const projectConfigPath = import_path.default.join(projectPath, ".agent-config.json");
      if (import_fs.default.existsSync(projectConfigPath)) {
        try {
          const projectRaw = import_fs.default.readFileSync(projectConfigPath, "utf8");
          const projectParsed = JSON.parse(projectRaw);
          config = this.mergeConfig(config, projectParsed);
        } catch {
        }
      }
    }
    return config;
  }
  write(config) {
    const dir = import_path.default.dirname(this.configPath);
    if (!import_fs.default.existsSync(dir)) {
      import_fs.default.mkdirSync(dir, { recursive: true });
    }
    import_fs.default.writeFileSync(this.configPath, JSON.stringify(config, null, 2), { encoding: "utf8" });
  }
  setProvider(provider, config) {
    const current = this.read();
    current.providers[provider] = config;
    this.write(current);
  }
  removeProvider(provider) {
    const current = this.read();
    delete current.providers[provider];
    this.write(current);
  }
  setSyncTarget(toolId, enabled) {
    const current = this.read();
    current.syncTargets[toolId] = enabled;
    this.write(current);
  }
  setToolOverride(toolId, override) {
    const current = this.read();
    current.tools[toolId] = override;
    this.write(current);
  }
  updateHashes(hashes) {
    const current = this.read();
    current.hashes = { ...current.hashes, ...hashes };
    current.lastSyncedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.write(current);
  }
  mergeConfig(base, override) {
    return {
      ...base,
      ...override,
      providers: { ...base.providers, ...override.providers },
      defaults: { ...base.defaults, ...override.defaults },
      syncTargets: { ...base.syncTargets, ...override.syncTargets },
      tools: { ...base.tools, ...override.tools }
    };
  }
};

// src/core/keychain.ts
var import_os2 = __toESM(require("os"));
var import_path2 = __toESM(require("path"));
var import_fs2 = __toESM(require("fs"));
var import_crypto = __toESM(require("crypto"));
var SERVICE_NAME = "agent-config-sync";
var keytarModule = null;
try {
  keytarModule = require("keytar");
} catch {
  keytarModule = null;
}
var KeychainManager = class {
  fallbackVaultPath;
  vaultKeyPath;
  constructor(customDir) {
    const baseDir = customDir || import_path2.default.join(import_os2.default.homedir(), ".agent-config");
    this.fallbackVaultPath = import_path2.default.join(baseDir, ".vault.enc");
    this.vaultKeyPath = import_path2.default.join(baseDir, ".vault.key");
  }
  isNativeSupported() {
    return keytarModule !== null;
  }
  /**
   * Saves a secret to the native keychain (or encrypted fallback vault).
   * Returns a keychain reference string, e.g. "agent-config-sync:openai"
   */
  async setSecret(account, secret) {
    const ref = `${SERVICE_NAME}:${account}`;
    if (this.isNativeSupported()) {
      try {
        await keytarModule.setPassword(SERVICE_NAME, account, secret);
        return ref;
      } catch {
      }
    }
    await this.setVaultSecret(account, secret);
    return ref;
  }
  /**
   * Retrieves a secret by its keychain reference or account name.
   */
  async getSecret(refOrAccount) {
    const account = refOrAccount.replace(`${SERVICE_NAME}:`, "");
    if (this.isNativeSupported()) {
      try {
        const secret = await keytarModule.getPassword(SERVICE_NAME, account);
        if (secret) return secret;
      } catch {
      }
    }
    return this.getVaultSecret(account);
  }
  /**
   * Deletes a secret from keychain / vault.
   */
  async deleteSecret(refOrAccount) {
    const account = refOrAccount.replace(`${SERVICE_NAME}:`, "");
    let deleted = false;
    if (this.isNativeSupported()) {
      try {
        deleted = await keytarModule.deletePassword(SERVICE_NAME, account);
      } catch {
      }
    }
    const vaultDeleted = await this.deleteVaultSecret(account);
    return deleted || vaultDeleted;
  }
  // --- Encrypted File Vault Fallback (AES-256-GCM) ---
  getOrCreateVaultMasterKey() {
    if (!import_fs2.default.existsSync(import_path2.default.dirname(this.vaultKeyPath))) {
      import_fs2.default.mkdirSync(import_path2.default.dirname(this.vaultKeyPath), { recursive: true });
    }
    if (import_fs2.default.existsSync(this.vaultKeyPath)) {
      const keyHex = import_fs2.default.readFileSync(this.vaultKeyPath, "utf8").trim();
      return Buffer.from(keyHex, "hex");
    }
    const machineFingerprint = `${import_os2.default.hostname()}-${import_os2.default.userInfo().username}-${import_os2.default.arch()}`;
    const salt = import_crypto.default.randomBytes(16);
    const masterKey = import_crypto.default.pbkdf2Sync(machineFingerprint, salt, 1e5, 32, "sha256");
    import_fs2.default.writeFileSync(this.vaultKeyPath, masterKey.toString("hex"), { mode: 384 });
    return masterKey;
  }
  readVault() {
    if (!import_fs2.default.existsSync(this.fallbackVaultPath)) {
      return {};
    }
    try {
      const masterKey = this.getOrCreateVaultMasterKey();
      const raw = import_fs2.default.readFileSync(this.fallbackVaultPath, "utf8");
      const payload = JSON.parse(raw);
      const iv = Buffer.from(payload.iv, "hex");
      const authTag = Buffer.from(payload.tag, "hex");
      const decipher = import_crypto.default.createDecipheriv("aes-256-gcm", masterKey, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(payload.content, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return JSON.parse(decrypted);
    } catch {
      return {};
    }
  }
  writeVault(data) {
    if (!import_fs2.default.existsSync(import_path2.default.dirname(this.fallbackVaultPath))) {
      import_fs2.default.mkdirSync(import_path2.default.dirname(this.fallbackVaultPath), { recursive: true });
    }
    const masterKey = this.getOrCreateVaultMasterKey();
    const iv = import_crypto.default.randomBytes(12);
    const cipher = import_crypto.default.createCipheriv("aes-256-gcm", masterKey, iv);
    const text = JSON.stringify(data);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");
    const payload = {
      iv: iv.toString("hex"),
      tag: authTag,
      content: encrypted
    };
    import_fs2.default.writeFileSync(this.fallbackVaultPath, JSON.stringify(payload, null, 2), { mode: 384 });
  }
  async setVaultSecret(account, secret) {
    const vault = this.readVault();
    vault[account] = secret;
    this.writeVault(vault);
  }
  async getVaultSecret(account) {
    const vault = this.readVault();
    return vault[account] || null;
  }
  async deleteVaultSecret(account) {
    const vault = this.readVault();
    if (account in vault) {
      delete vault[account];
      this.writeVault(vault);
      return true;
    }
    return false;
  }
};

// src/adapters/cursor-adapter.ts
var import_os3 = __toESM(require("os"));
var import_path4 = __toESM(require("path"));
var import_fs4 = __toESM(require("fs"));

// src/adapters/base-adapter.ts
var import_crypto2 = __toESM(require("crypto"));
var BaseAdapter = class {
  /**
   * Computes SHA-256 hash of configuration content string.
   */
  computeHash(content) {
    return import_crypto2.default.createHash("sha256").update(content, "utf8").digest("hex");
  }
};

// src/core/backup.ts
var import_fs3 = __toESM(require("fs"));
var import_path3 = __toESM(require("path"));
async function createBackup(filePath) {
  if (!import_fs3.default.existsSync(filePath)) {
    return null;
  }
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "").replace("T", "_").slice(0, 15);
  const dir = import_path3.default.dirname(filePath);
  const ext = import_path3.default.extname(filePath);
  const baseName = import_path3.default.basename(filePath, ext);
  const backupFileName = `${baseName}.${timestamp}.bak${ext}`;
  const backupPath = import_path3.default.join(dir, backupFileName);
  import_fs3.default.copyFileSync(filePath, backupPath);
  return backupPath;
}

// src/core/secret-masker.ts
function maskSecret(secret) {
  if (!secret) return "(empty)";
  if (secret.length <= 8) {
    return "***";
  }
  const prefixLength = secret.startsWith("sk-ant-") ? 7 : secret.startsWith("sk-") ? 3 : 4;
  const suffixLength = 4;
  const prefix = secret.slice(0, prefixLength);
  const suffix = secret.slice(-suffixLength);
  return `${prefix}***${suffix}`;
}

// src/adapters/cursor-adapter.ts
var CursorAdapter = class extends BaseAdapter {
  id = "cursor";
  name = "Cursor IDE";
  getConfigPath(overridePath) {
    if (overridePath) return overridePath;
    const platform = import_os3.default.platform();
    const home = import_os3.default.homedir();
    if (platform === "darwin") {
      return import_path4.default.join(home, "Library", "Application Support", "Cursor", "User", "settings.json");
    } else if (platform === "win32") {
      const appData = process.env.APPDATA || import_path4.default.join(home, "AppData", "Roaming");
      return import_path4.default.join(appData, "Cursor", "User", "settings.json");
    } else {
      return import_path4.default.join(home, ".config", "Cursor", "User", "settings.json");
    }
  }
  async isInstalled() {
    const filePath = this.getConfigPath();
    const cursorDir = import_path4.default.dirname(filePath);
    return import_fs4.default.existsSync(cursorDir);
  }
  async readConfig(overridePath) {
    const filePath = this.getConfigPath(overridePath);
    if (!import_fs4.default.existsSync(filePath)) {
      return {};
    }
    try {
      const raw = import_fs4.default.readFileSync(filePath, "utf8");
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  async sync(centralConfig, secrets, options) {
    const filePath = this.getConfigPath(centralConfig.tools[this.id]?.customConfigPath);
    const changes = [];
    const currentConfig = await this.readConfig(filePath);
    const updatedConfig = { ...currentConfig };
    const openaiKey = secrets.openai;
    const anthropicKey = secrets.anthropic;
    if (openaiKey) {
      if (currentConfig["cursor.general.openaiApiKey"] !== openaiKey) {
        updatedConfig["cursor.general.openaiApiKey"] = openaiKey;
        changes.push(`Set cursor.general.openaiApiKey (${maskSecret(openaiKey)})`);
      }
    }
    if (anthropicKey) {
      if (currentConfig["cursor.general.anthropicApiKey"] !== anthropicKey) {
        updatedConfig["cursor.general.anthropicApiKey"] = anthropicKey;
        changes.push(`Set cursor.general.anthropicApiKey (${maskSecret(anthropicKey)})`);
      }
    }
    const defaultModel = centralConfig.defaults.defaultModel;
    if (defaultModel && currentConfig["cursor.ai.model"] !== defaultModel) {
      updatedConfig["cursor.ai.model"] = defaultModel;
      changes.push(`Set cursor.ai.model to "${defaultModel}"`);
    }
    if (changes.length === 0) {
      return {
        toolId: this.id,
        toolName: this.name,
        success: true,
        filePath,
        action: "unchanged",
        changes: []
      };
    }
    if (options.dryRun) {
      return {
        toolId: this.id,
        toolName: this.name,
        success: true,
        filePath,
        action: "updated",
        changes
      };
    }
    await createBackup(filePath);
    const dir = import_path4.default.dirname(filePath);
    if (!import_fs4.default.existsSync(dir)) {
      import_fs4.default.mkdirSync(dir, { recursive: true });
    }
    import_fs4.default.writeFileSync(filePath, JSON.stringify(updatedConfig, null, 2), "utf8");
    return {
      toolId: this.id,
      toolName: this.name,
      success: true,
      filePath,
      action: import_fs4.default.existsSync(filePath) ? "updated" : "created",
      changes
    };
  }
  async checkDrift(centralConfig, secrets) {
    const filePath = this.getConfigPath(centralConfig.tools[this.id]?.customConfigPath);
    const installed = await this.isInstalled();
    const exists = import_fs4.default.existsSync(filePath);
    if (!exists) {
      return { toolId: this.id, toolName: this.name, installed, configPath: filePath, exists, drifted: false };
    }
    const currentConfig = await this.readConfig(filePath);
    let drifted = false;
    let reason = "";
    if (secrets.anthropic && currentConfig["cursor.general.anthropicApiKey"] !== secrets.anthropic) {
      drifted = true;
      reason = "Anthropic API key mismatch";
    }
    if (secrets.openai && currentConfig["cursor.general.openaiApiKey"] !== secrets.openai) {
      drifted = true;
      reason = reason ? `${reason}, OpenAI API key mismatch` : "OpenAI API key mismatch";
    }
    return { toolId: this.id, toolName: this.name, installed, configPath: filePath, exists, drifted, reason };
  }
};

// src/adapters/claude-code-adapter.ts
var import_os4 = __toESM(require("os"));
var import_path5 = __toESM(require("path"));
var import_fs5 = __toESM(require("fs"));
var ClaudeCodeAdapter = class extends BaseAdapter {
  id = "claude-code";
  name = "Claude Code CLI";
  getConfigPath(overridePath) {
    if (overridePath) return overridePath;
    return import_path5.default.join(import_os4.default.homedir(), ".claude", "settings.json");
  }
  getMcpConfigPath() {
    return import_path5.default.join(import_os4.default.homedir(), ".claude.json");
  }
  async isInstalled() {
    const mainDir = import_path5.default.dirname(this.getConfigPath());
    const mcpFile = this.getMcpConfigPath();
    return import_fs5.default.existsSync(mainDir) || import_fs5.default.existsSync(mcpFile);
  }
  async readConfig(overridePath) {
    const filePath = this.getConfigPath(overridePath);
    if (!import_fs5.default.existsSync(filePath)) {
      return {};
    }
    try {
      const raw = import_fs5.default.readFileSync(filePath, "utf8");
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  async sync(centralConfig, secrets, options) {
    const filePath = this.getConfigPath(centralConfig.tools[this.id]?.customConfigPath);
    const changes = [];
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
    const mcpPath = this.getMcpConfigPath();
    let mcpUpdated = false;
    let mcpConfig = {};
    if (anthropicKey && import_fs5.default.existsSync(mcpPath)) {
      try {
        mcpConfig = JSON.parse(import_fs5.default.readFileSync(mcpPath, "utf8"));
        if (mcpConfig.primaryApiKey !== anthropicKey) {
          mcpConfig.primaryApiKey = anthropicKey;
          mcpUpdated = true;
          changes.push(`Set primaryApiKey in ~/.claude.json (${maskSecret(anthropicKey)})`);
        }
      } catch {
      }
    }
    if (changes.length === 0) {
      return {
        toolId: this.id,
        toolName: this.name,
        success: true,
        filePath,
        action: "unchanged",
        changes: []
      };
    }
    if (options.dryRun) {
      return {
        toolId: this.id,
        toolName: this.name,
        success: true,
        filePath,
        action: "updated",
        changes
      };
    }
    await createBackup(filePath);
    const dir = import_path5.default.dirname(filePath);
    if (!import_fs5.default.existsSync(dir)) {
      import_fs5.default.mkdirSync(dir, { recursive: true });
    }
    import_fs5.default.writeFileSync(filePath, JSON.stringify(updatedConfig, null, 2), "utf8");
    if (mcpUpdated) {
      await createBackup(mcpPath);
      import_fs5.default.writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2), "utf8");
    }
    return {
      toolId: this.id,
      toolName: this.name,
      success: true,
      filePath,
      action: import_fs5.default.existsSync(filePath) ? "updated" : "created",
      changes
    };
  }
  async checkDrift(centralConfig, secrets) {
    const filePath = this.getConfigPath(centralConfig.tools[this.id]?.customConfigPath);
    const installed = await this.isInstalled();
    const exists = import_fs5.default.existsSync(filePath);
    if (!exists) {
      return { toolId: this.id, toolName: this.name, installed, configPath: filePath, exists, drifted: false };
    }
    const currentConfig = await this.readConfig(filePath);
    let drifted = false;
    let reason = "";
    const anthropicKey = secrets.anthropic || secrets.primary;
    if (anthropicKey && currentConfig.env?.ANTHROPIC_API_KEY !== anthropicKey) {
      drifted = true;
      reason = "Anthropic API key mismatch";
    }
    return { toolId: this.id, toolName: this.name, installed, configPath: filePath, exists, drifted, reason };
  }
};

// src/adapters/cline-adapter.ts
var import_os5 = __toESM(require("os"));
var import_path6 = __toESM(require("path"));
var import_fs6 = __toESM(require("fs"));
var ClineAdapter = class extends BaseAdapter {
  id = "cline";
  name = "Cline Extension";
  getConfigPath(overridePath) {
    if (overridePath) return overridePath;
    return import_path6.default.join(import_os5.default.homedir(), ".cline", "data", "settings", "providers.json");
  }
  async isInstalled() {
    const clineDir = import_path6.default.join(import_os5.default.homedir(), ".cline");
    return import_fs6.default.existsSync(clineDir);
  }
  async readConfig(overridePath) {
    const filePath = this.getConfigPath(overridePath);
    if (!import_fs6.default.existsSync(filePath)) {
      return {};
    }
    try {
      const raw = import_fs6.default.readFileSync(filePath, "utf8");
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  async sync(centralConfig, secrets, options) {
    const filePath = this.getConfigPath(centralConfig.tools[this.id]?.customConfigPath);
    const changes = [];
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
        action: "unchanged",
        changes: []
      };
    }
    if (options.dryRun) {
      return {
        toolId: this.id,
        toolName: this.name,
        success: true,
        filePath,
        action: "updated",
        changes
      };
    }
    await createBackup(filePath);
    const dir = import_path6.default.dirname(filePath);
    if (!import_fs6.default.existsSync(dir)) {
      import_fs6.default.mkdirSync(dir, { recursive: true });
    }
    import_fs6.default.writeFileSync(filePath, JSON.stringify(updatedConfig, null, 2), "utf8");
    return {
      toolId: this.id,
      toolName: this.name,
      success: true,
      filePath,
      action: import_fs6.default.existsSync(filePath) ? "updated" : "created",
      changes
    };
  }
  async checkDrift(centralConfig, secrets) {
    const filePath = this.getConfigPath(centralConfig.tools[this.id]?.customConfigPath);
    const installed = await this.isInstalled();
    const exists = import_fs6.default.existsSync(filePath);
    if (!exists) {
      return { toolId: this.id, toolName: this.name, installed, configPath: filePath, exists, drifted: false };
    }
    const currentConfig = await this.readConfig(filePath);
    let drifted = false;
    let reason = "";
    if (secrets.anthropic && currentConfig.anthropic?.apiKey !== secrets.anthropic) {
      drifted = true;
      reason = "Anthropic key mismatch";
    }
    if (secrets.openai && currentConfig.openai?.apiKey !== secrets.openai) {
      drifted = true;
      reason = reason ? `${reason}, OpenAI key mismatch` : "OpenAI key mismatch";
    }
    return { toolId: this.id, toolName: this.name, installed, configPath: filePath, exists, drifted, reason };
  }
};

// src/adapters/codex-cli-adapter.ts
var import_os6 = __toESM(require("os"));
var import_path7 = __toESM(require("path"));
var import_fs7 = __toESM(require("fs"));
var import_smol_toml = require("smol-toml");
var CodexCLIAdapter = class extends BaseAdapter {
  id = "codex";
  name = "Codex CLI";
  getConfigPath(overridePath) {
    if (overridePath) return overridePath;
    const home = import_os6.default.homedir();
    return import_path7.default.join(home, ".codex", "config.toml");
  }
  async isInstalled() {
    const codexDir = import_path7.default.join(import_os6.default.homedir(), ".codex");
    return import_fs7.default.existsSync(codexDir);
  }
  async readConfig(overridePath) {
    const filePath = this.getConfigPath(overridePath);
    if (!import_fs7.default.existsSync(filePath)) {
      return {};
    }
    try {
      const raw = import_fs7.default.readFileSync(filePath, "utf8");
      return (0, import_smol_toml.parse)(raw);
    } catch {
      return {};
    }
  }
  async sync(centralConfig, secrets, options) {
    const filePath = this.getConfigPath(centralConfig.tools[this.id]?.customConfigPath);
    const changes = [];
    const currentConfig = await this.readConfig(filePath);
    const updatedConfig = { ...currentConfig };
    const defaultModel = centralConfig.defaults.defaultModel;
    if (defaultModel && updatedConfig.model !== defaultModel) {
      updatedConfig.model = defaultModel;
      changes.push(`Set model = "${defaultModel}"`);
    }
    const primaryProvider = centralConfig.defaults.primaryProvider;
    if (primaryProvider && updatedConfig.model_provider !== primaryProvider) {
      updatedConfig.model_provider = primaryProvider;
      changes.push(`Set model_provider = "${primaryProvider}"`);
    }
    if (!updatedConfig.api_keys) {
      updatedConfig.api_keys = {};
    }
    for (const [provider, key] of Object.entries(secrets)) {
      if (!key) continue;
      if (updatedConfig.api_keys[provider] !== key) {
        updatedConfig.api_keys[provider] = key;
        changes.push(`Set api_keys.${provider} (${maskSecret(key)})`);
      }
    }
    if (changes.length === 0) {
      return {
        toolId: this.id,
        toolName: this.name,
        success: true,
        filePath,
        action: "unchanged",
        changes: []
      };
    }
    if (options.dryRun) {
      return {
        toolId: this.id,
        toolName: this.name,
        success: true,
        filePath,
        action: "updated",
        changes
      };
    }
    await createBackup(filePath);
    const dir = import_path7.default.dirname(filePath);
    if (!import_fs7.default.existsSync(dir)) {
      import_fs7.default.mkdirSync(dir, { recursive: true });
    }
    const tomlContent = (0, import_smol_toml.stringify)(updatedConfig);
    import_fs7.default.writeFileSync(filePath, tomlContent, "utf8");
    return {
      toolId: this.id,
      toolName: this.name,
      success: true,
      filePath,
      action: import_fs7.default.existsSync(filePath) ? "updated" : "created",
      changes
    };
  }
  async checkDrift(centralConfig, secrets) {
    const filePath = this.getConfigPath(centralConfig.tools[this.id]?.customConfigPath);
    const installed = await this.isInstalled();
    const exists = import_fs7.default.existsSync(filePath);
    if (!exists) {
      return { toolId: this.id, toolName: this.name, installed, configPath: filePath, exists, drifted: false };
    }
    const currentConfig = await this.readConfig(filePath);
    let drifted = false;
    let reason = "";
    const apiKeys = currentConfig.api_keys || {};
    if (secrets.openai && apiKeys.openai !== secrets.openai) {
      drifted = true;
      reason = "OpenAI API key mismatch in TOML";
    }
    return { toolId: this.id, toolName: this.name, installed, configPath: filePath, exists, drifted, reason };
  }
};

// src/adapters/windsurf-adapter.ts
var import_os7 = __toESM(require("os"));
var import_path8 = __toESM(require("path"));
var import_fs8 = __toESM(require("fs"));
var WindsurfAdapter = class extends BaseAdapter {
  id = "windsurf";
  name = "Windsurf IDE";
  getConfigPath(overridePath) {
    if (overridePath) return overridePath;
    const platform = import_os7.default.platform();
    const home = import_os7.default.homedir();
    if (platform === "darwin") {
      return import_path8.default.join(home, "Library", "Application Support", "Windsurf", "User", "settings.json");
    } else if (platform === "win32") {
      const appData = process.env.APPDATA || import_path8.default.join(home, "AppData", "Roaming");
      return import_path8.default.join(appData, "Windsurf", "User", "settings.json");
    } else {
      return import_path8.default.join(home, ".config", "Windsurf", "User", "settings.json");
    }
  }
  getMcpConfigPath() {
    return import_path8.default.join(import_os7.default.homedir(), ".codeium", "windsurf", "mcp_config.json");
  }
  async isInstalled() {
    const mainPath = this.getConfigPath();
    const windsurfDir = import_path8.default.dirname(mainPath);
    const mcpDir = import_path8.default.dirname(this.getMcpConfigPath());
    return import_fs8.default.existsSync(windsurfDir) || import_fs8.default.existsSync(mcpDir);
  }
  async readConfig(overridePath) {
    const filePath = this.getConfigPath(overridePath);
    if (!import_fs8.default.existsSync(filePath)) {
      return {};
    }
    try {
      const raw = import_fs8.default.readFileSync(filePath, "utf8");
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  async sync(centralConfig, secrets, options) {
    const filePath = this.getConfigPath(centralConfig.tools[this.id]?.customConfigPath);
    const changes = [];
    const currentConfig = await this.readConfig(filePath);
    const updatedConfig = { ...currentConfig };
    const defaultModel = centralConfig.defaults.defaultModel;
    if (defaultModel && updatedConfig["windsurf.model"] !== defaultModel) {
      updatedConfig["windsurf.model"] = defaultModel;
      changes.push(`Set windsurf.model to "${defaultModel}"`);
    }
    if (!updatedConfig["windsurf.apiKeys"]) {
      updatedConfig["windsurf.apiKeys"] = {};
    }
    for (const [provider, key] of Object.entries(secrets)) {
      if (!key) continue;
      if (updatedConfig["windsurf.apiKeys"][provider] !== key) {
        updatedConfig["windsurf.apiKeys"][provider] = key;
        changes.push(`Set windsurf.apiKeys.${provider} (${maskSecret(key)})`);
      }
    }
    if (changes.length === 0) {
      return {
        toolId: this.id,
        toolName: this.name,
        success: true,
        filePath,
        action: "unchanged",
        changes: []
      };
    }
    if (options.dryRun) {
      return {
        toolId: this.id,
        toolName: this.name,
        success: true,
        filePath,
        action: "updated",
        changes
      };
    }
    await createBackup(filePath);
    const dir = import_path8.default.dirname(filePath);
    if (!import_fs8.default.existsSync(dir)) {
      import_fs8.default.mkdirSync(dir, { recursive: true });
    }
    import_fs8.default.writeFileSync(filePath, JSON.stringify(updatedConfig, null, 2), "utf8");
    return {
      toolId: this.id,
      toolName: this.name,
      success: true,
      filePath,
      action: import_fs8.default.existsSync(filePath) ? "updated" : "created",
      changes
    };
  }
  async checkDrift(centralConfig, secrets) {
    const filePath = this.getConfigPath(centralConfig.tools[this.id]?.customConfigPath);
    const installed = await this.isInstalled();
    const exists = import_fs8.default.existsSync(filePath);
    if (!exists) {
      return { toolId: this.id, toolName: this.name, installed, configPath: filePath, exists, drifted: false };
    }
    const currentConfig = await this.readConfig(filePath);
    let drifted = false;
    let reason = "";
    const apiKeys = currentConfig["windsurf.apiKeys"] || {};
    if (secrets.anthropic && apiKeys.anthropic !== secrets.anthropic) {
      drifted = true;
      reason = "Anthropic key mismatch in Windsurf settings";
    }
    return { toolId: this.id, toolName: this.name, installed, configPath: filePath, exists, drifted, reason };
  }
};

// src/adapters/continue-adapter.ts
var import_os8 = __toESM(require("os"));
var import_path9 = __toESM(require("path"));
var import_fs9 = __toESM(require("fs"));
var import_yaml = __toESM(require("yaml"));
var ContinueAdapter = class extends BaseAdapter {
  id = "continue-dev";
  name = "Continue.dev";
  getConfigPath(overridePath) {
    if (overridePath) return overridePath;
    const home = import_os8.default.homedir();
    const yamlPath = import_path9.default.join(home, ".continue", "config.yaml");
    const jsonPath = import_path9.default.join(home, ".continue", "config.json");
    if (import_fs9.default.existsSync(jsonPath) && !import_fs9.default.existsSync(yamlPath)) {
      return jsonPath;
    }
    return yamlPath;
  }
  async isInstalled() {
    const continueDir = import_path9.default.join(import_os8.default.homedir(), ".continue");
    return import_fs9.default.existsSync(continueDir);
  }
  async readConfig(overridePath) {
    const filePath = this.getConfigPath(overridePath);
    if (!import_fs9.default.existsSync(filePath)) {
      return {};
    }
    try {
      const raw = import_fs9.default.readFileSync(filePath, "utf8");
      if (filePath.endsWith(".json")) {
        return JSON.parse(raw);
      } else {
        return import_yaml.default.parse(raw) || {};
      }
    } catch {
      return {};
    }
  }
  async sync(centralConfig, secrets, options) {
    const filePath = this.getConfigPath(centralConfig.tools[this.id]?.customConfigPath);
    const changes = [];
    const currentConfig = await this.readConfig(filePath);
    const updatedConfig = { ...currentConfig };
    if (!Array.isArray(updatedConfig.models)) {
      updatedConfig.models = [];
    }
    for (const [provider, key] of Object.entries(secrets)) {
      if (!key) continue;
      const modelName = centralConfig.providers[provider]?.defaultModel || centralConfig.defaults.defaultModel || `${provider}-default`;
      const existingModelIdx = updatedConfig.models.findIndex(
        (m) => m && (m.provider === provider || m.name === modelName)
      );
      if (existingModelIdx >= 0) {
        const existing = updatedConfig.models[existingModelIdx];
        if (existing.apiKey !== key || existing.model !== modelName) {
          updatedConfig.models[existingModelIdx] = {
            ...existing,
            provider,
            model: modelName,
            apiKey: key
          };
          changes.push(`Updated Continue model entry for "${provider}" (${maskSecret(key)})`);
        }
      } else {
        updatedConfig.models.push({
          name: modelName,
          provider,
          model: modelName,
          apiKey: key,
          roles: ["chat", "edit"]
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
        action: "unchanged",
        changes: []
      };
    }
    if (options.dryRun) {
      return {
        toolId: this.id,
        toolName: this.name,
        success: true,
        filePath,
        action: "updated",
        changes
      };
    }
    await createBackup(filePath);
    const dir = import_path9.default.dirname(filePath);
    if (!import_fs9.default.existsSync(dir)) {
      import_fs9.default.mkdirSync(dir, { recursive: true });
    }
    if (filePath.endsWith(".json")) {
      import_fs9.default.writeFileSync(filePath, JSON.stringify(updatedConfig, null, 2), "utf8");
    } else {
      import_fs9.default.writeFileSync(filePath, import_yaml.default.stringify(updatedConfig), "utf8");
    }
    return {
      toolId: this.id,
      toolName: this.name,
      success: true,
      filePath,
      action: import_fs9.default.existsSync(filePath) ? "updated" : "created",
      changes
    };
  }
  async checkDrift(centralConfig, secrets) {
    const filePath = this.getConfigPath(centralConfig.tools[this.id]?.customConfigPath);
    const installed = await this.isInstalled();
    const exists = import_fs9.default.existsSync(filePath);
    if (!exists) {
      return { toolId: this.id, toolName: this.name, installed, configPath: filePath, exists, drifted: false };
    }
    const currentConfig = await this.readConfig(filePath);
    let drifted = false;
    let reason = "";
    const models = Array.isArray(currentConfig.models) ? currentConfig.models : [];
    if (secrets.anthropic) {
      const anthropicModel = models.find((m) => m && m.provider === "anthropic");
      if (!anthropicModel || anthropicModel.apiKey !== secrets.anthropic) {
        drifted = true;
        reason = "Anthropic model apiKey mismatch in Continue config";
      }
    }
    return { toolId: this.id, toolName: this.name, installed, configPath: filePath, exists, drifted, reason };
  }
};

// src/adapters/index.ts
function getAllAdapters() {
  return [
    new CursorAdapter(),
    new ClaudeCodeAdapter(),
    new ClineAdapter(),
    new CodexCLIAdapter(),
    new WindsurfAdapter(),
    new ContinueAdapter()
  ];
}

// src/cli/utils/logger.ts
var import_picocolors = __toESM(require("picocolors"));
var logger = {
  info: (msg) => console.log(`${import_picocolors.default.blue("\u2139")} ${msg}`),
  success: (msg) => console.log(`${import_picocolors.default.green("\u2714")} ${msg}`),
  warn: (msg) => console.log(`${import_picocolors.default.yellow("\u26A0")} ${msg}`),
  error: (msg) => console.log(`${import_picocolors.default.red("\u2716")} ${msg}`),
  heading: (msg) => console.log(`
${import_picocolors.default.bold(import_picocolors.default.cyan(msg))}`),
  subtle: (msg) => console.log(import_picocolors.default.gray(msg))
};

// src/cli/commands/init.ts
async function initCommand() {
  logger.heading("\u{1F680} Initializing Universal Agent Config Sync");
  const configStore = new ConfigStore();
  const keychain = new KeychainManager();
  const adapters = getAllAdapters();
  const installedTools = [];
  for (const adapter of adapters) {
    if (await adapter.isInstalled()) {
      installedTools.push(adapter.id);
      logger.success(`Detected ${adapter.name} (${adapter.getConfigPath()})`);
    }
  }
  if (installedTools.length === 0) {
    logger.warn("No AI coding agent tools were detected automatically, but all adapters remain available.");
  }
  const response = await (0, import_prompts.default)([
    {
      type: "select",
      name: "provider",
      message: "Select your primary AI provider to configure:",
      choices: [
        { title: "Anthropic (Claude)", value: "anthropic" },
        { title: "OpenAI (ChatGPT/Codex)", value: "openai" },
        { title: "Google Gemini", value: "google" },
        { title: "Ollama (Local)", value: "ollama" },
        { title: "OpenRouter", value: "openrouter" }
      ]
    },
    {
      type: "password",
      name: "apiKey",
      message: (prev) => `Enter your ${prev} API Key:`,
      validate: (val) => val && val.trim().length > 0 ? true : "API key cannot be empty"
    },
    {
      type: "text",
      name: "defaultModel",
      message: "Default model choice (optional):",
      initial: "claude-3-7-sonnet-20250219"
    }
  ]);
  if (!response.provider || !response.apiKey) {
    logger.warn("Initialization aborted.");
    return;
  }
  const ref = await keychain.setSecret(response.provider, response.apiKey.trim());
  const config = configStore.read();
  config.providers[response.provider] = {
    keychainRef: ref,
    defaultModel: response.defaultModel
  };
  config.defaults.primaryProvider = response.provider;
  config.defaults.defaultModel = response.defaultModel;
  for (const adapter of adapters) {
    config.syncTargets[adapter.id] = true;
  }
  configStore.write(config);
  logger.success(`Saved configuration for ${response.provider} to central store and secure keychain.`);
  logger.info(`Central config path: ${configStore.getConfigPath()}`);
  logger.info(`Run 'agent-config sync' to push this configuration to all detected tools.`);
}

// src/cli/commands/add.ts
var import_prompts2 = __toESM(require("prompts"));
async function addCommand(providerName) {
  const configStore = new ConfigStore();
  const keychain = new KeychainManager();
  let provider = providerName?.toLowerCase();
  if (!provider) {
    const res = await (0, import_prompts2.default)({
      type: "text",
      name: "provider",
      message: "Enter provider name (e.g. anthropic, openai, google, openrouter):",
      validate: (val) => val && val.trim().length > 0 ? true : "Provider name required"
    });
    provider = res.provider?.toLowerCase();
  }
  if (!provider) {
    logger.warn("No provider specified. Aborted.");
    return;
  }
  const keyRes = await (0, import_prompts2.default)({
    type: "password",
    name: "apiKey",
    message: `Enter API key for ${provider}:`,
    validate: (val) => val && val.trim().length > 0 ? true : "API key cannot be empty"
  });
  if (!keyRes.apiKey) {
    logger.warn("Operation cancelled.");
    return;
  }
  const modelRes = await (0, import_prompts2.default)({
    type: "text",
    name: "defaultModel",
    message: `Default model for ${provider} (optional):`
  });
  const ref = await keychain.setSecret(provider, keyRes.apiKey.trim());
  const config = configStore.read();
  config.providers[provider] = {
    keychainRef: ref,
    defaultModel: modelRes.defaultModel || config.providers[provider]?.defaultModel
  };
  configStore.write(config);
  logger.success(`Added/Updated provider "${provider}" with key (${maskSecret(keyRes.apiKey)})`);
  logger.info(`Run 'agent-config sync' to push changes.`);
}

// src/core/sync-engine.ts
var SyncEngine = class {
  configStore;
  keychain;
  constructor(configStore, keychain) {
    this.configStore = configStore || new ConfigStore();
    this.keychain = keychain || new KeychainManager();
  }
  /**
   * Resolves all provider secrets from keychain.
   */
  async getResolvedSecrets(config) {
    const secrets = {};
    for (const [provider, pConfig] of Object.entries(config.providers)) {
      if (pConfig.keychainRef) {
        const key = await this.keychain.getSecret(pConfig.keychainRef);
        if (key) {
          secrets[provider] = key;
        }
      }
    }
    return secrets;
  }
  /**
   * Synchronizes central config to native tool configs.
   */
  async sync(options = {}) {
    const config = this.configStore.read(options.projectPath);
    const secrets = await this.getResolvedSecrets(config);
    const adapters = getAllAdapters().filter((adapter) => {
      if (options.tools && options.tools.length > 0) {
        return options.tools.includes(adapter.id);
      }
      return config.syncTargets[adapter.id] !== false;
    });
    const results = [];
    for (const adapter of adapters) {
      try {
        const result = await adapter.sync(config, secrets, options);
        results.push(result);
      } catch (err) {
        results.push({
          toolId: adapter.id,
          toolName: adapter.name,
          success: false,
          filePath: adapter.getConfigPath(),
          action: "error",
          changes: [],
          error: err.message
        });
      }
    }
    return results;
  }
  /**
   * Performs drift check across all adapters.
   */
  async getDriftStatus(projectPath) {
    const config = this.configStore.read(projectPath);
    const secrets = await this.getResolvedSecrets(config);
    const adapters = getAllAdapters();
    const statuses = [];
    for (const adapter of adapters) {
      try {
        const status = await adapter.checkDrift(config, secrets);
        statuses.push(status);
      } catch (err) {
        statuses.push({
          toolId: adapter.id,
          toolName: adapter.name,
          installed: false,
          configPath: adapter.getConfigPath(),
          exists: false,
          drifted: true,
          reason: err.message
        });
      }
    }
    return statuses;
  }
};

// src/cli/commands/sync.ts
async function syncCommand(cmdOptions) {
  const syncEngine = new SyncEngine();
  const toolList = cmdOptions.tools ? cmdOptions.tools.split(",").map((t) => t.trim()) : void 0;
  const projectPath = cmdOptions.project ? process.cwd() : void 0;
  if (cmdOptions.dryRun) {
    logger.heading("\u{1F50D} Running Sync in Dry-Run Mode (No files will be modified)");
  } else {
    logger.heading("\u{1F504} Synchronizing AI Agent Configurations");
  }
  const results = await syncEngine.sync({
    dryRun: cmdOptions.dryRun,
    tools: toolList,
    projectPath
  });
  let anyChanged = false;
  for (const result of results) {
    if (!result.success) {
      logger.error(`${result.toolName}: Error - ${result.error}`);
      continue;
    }
    if (result.action === "unchanged") {
      logger.subtle(`${result.toolName}: Up-to-date (${result.filePath})`);
    } else {
      anyChanged = true;
      const tag = cmdOptions.dryRun ? "[DRY-RUN WOULD WRITE]" : "[UPDATED]";
      logger.success(`${result.toolName} ${tag} -> ${result.filePath}`);
      for (const change of result.changes) {
        console.log(`    \u2514\u2500 ${change}`);
      }
    }
  }
  if (!anyChanged && !cmdOptions.dryRun) {
    logger.info("All target tool configurations are already in sync!");
  } else if (cmdOptions.dryRun) {
    logger.info("Run 'agent-config sync' without --dry-run to apply these changes.");
  }
}

// src/cli/commands/status.ts
var import_cli_table3 = __toESM(require("cli-table3"));
var import_picocolors2 = __toESM(require("picocolors"));
async function statusCommand() {
  const configStore = new ConfigStore();
  const keychain = new KeychainManager();
  const syncEngine = new SyncEngine(configStore, keychain);
  logger.heading("\u{1F4CA} Central Config & Provider Status");
  const config = configStore.read();
  const providersTable = new import_cli_table3.default({
    head: [import_picocolors2.default.cyan("Provider"), import_picocolors2.default.cyan("Keychain Ref"), import_picocolors2.default.cyan("Secret Status"), import_picocolors2.default.cyan("Default Model")]
  });
  for (const [provider, pConfig] of Object.entries(config.providers)) {
    const key = await keychain.getSecret(pConfig.keychainRef);
    const secretDisplay = key ? import_picocolors2.default.green(`Present (${maskSecret(key)})`) : import_picocolors2.default.red("Missing from Keychain");
    providersTable.push([provider, pConfig.keychainRef, secretDisplay, pConfig.defaultModel || "(default)"]);
  }
  if (Object.keys(config.providers).length === 0) {
    console.log(import_picocolors2.default.gray('  No providers configured yet. Run "agent-config add <provider>" to add one.'));
  } else {
    console.log(providersTable.toString());
  }
  logger.heading("\u{1F6E0} Target Tool Sync & Drift Status");
  const driftStatuses = await syncEngine.getDriftStatus();
  const toolsTable = new import_cli_table3.default({
    head: [import_picocolors2.default.cyan("Tool"), import_picocolors2.default.cyan("Installed"), import_picocolors2.default.cyan("Config File Path"), import_picocolors2.default.cyan("Sync Status")]
  });
  for (const status of driftStatuses) {
    const installedText = status.installed ? import_picocolors2.default.green("Yes") : import_picocolors2.default.gray("No");
    let syncStatusText = import_picocolors2.default.gray("Not Installed");
    if (status.exists) {
      if (status.drifted) {
        syncStatusText = import_picocolors2.default.yellow(`\u26A0\uFE0F Drifted (${status.reason || "Manual Edits Detected"})`);
      } else {
        syncStatusText = import_picocolors2.default.green("\u2714 In Sync");
      }
    } else if (status.installed) {
      syncStatusText = import_picocolors2.default.blue("Pending Sync");
    }
    toolsTable.push([status.toolName, installedText, status.configPath, syncStatusText]);
  }
  console.log(toolsTable.toString());
}

// src/cli/commands/doctor.ts
var import_fs10 = __toESM(require("fs"));
var import_path10 = __toESM(require("path"));
var import_picocolors3 = __toESM(require("picocolors"));
async function doctorCommand() {
  logger.heading("\u{1FA7A} Running Agent Config Doctor Checks");
  const configStore = new ConfigStore();
  const keychain = new KeychainManager();
  const checks = [];
  if (configStore.exists()) {
    checks.push({
      name: "Central Config File",
      status: "ok",
      message: `Found at ${configStore.getConfigPath()}`
    });
  } else {
    checks.push({
      name: "Central Config File",
      status: "warn",
      message: `Not initialized. Run "agent-config init" to create it.`
    });
  }
  if (keychain.isNativeSupported()) {
    checks.push({
      name: "Keychain Storage",
      status: "ok",
      message: "Using OS Native Keychain (keytar)"
    });
  } else {
    checks.push({
      name: "Keychain Storage",
      status: "warn",
      message: "Native keytar unavailable; using encrypted file vault (AES-256-GCM fallback)"
    });
  }
  const config = configStore.read();
  for (const [provider, pConfig] of Object.entries(config.providers)) {
    const key = await keychain.getSecret(pConfig.keychainRef);
    if (!key) {
      checks.push({
        name: `Provider: ${provider}`,
        status: "error",
        message: `Missing API key in keychain (${pConfig.keychainRef})`
      });
    } else if (key.length < 10) {
      checks.push({
        name: `Provider: ${provider}`,
        status: "warn",
        message: `API key seems suspiciously short (${maskSecret(key)})`
      });
    } else {
      checks.push({
        name: `Provider: ${provider}`,
        status: "ok",
        message: `Key valid & secure (${maskSecret(key)})`
      });
    }
  }
  const adapters = getAllAdapters();
  for (const adapter of adapters) {
    const filePath = adapter.getConfigPath();
    const dirPath = import_path10.default.dirname(filePath);
    if (import_fs10.default.existsSync(dirPath)) {
      try {
        import_fs10.default.accessSync(dirPath, import_fs10.default.constants.W_OK);
        checks.push({
          name: `Tool Directory: ${adapter.name}`,
          status: "ok",
          message: `Writable (${dirPath})`
        });
      } catch {
        checks.push({
          name: `Tool Directory: ${adapter.name}`,
          status: "error",
          message: `Permission denied writing to ${dirPath}`
        });
      }
    }
  }
  let hasErrors = false;
  for (const check of checks) {
    if (check.status === "ok") {
      console.log(`${import_picocolors3.default.green("\u2714")} ${import_picocolors3.default.bold(check.name)}: ${check.message}`);
    } else if (check.status === "warn") {
      console.log(`${import_picocolors3.default.yellow("\u26A0")} ${import_picocolors3.default.bold(check.name)}: ${check.message}`);
    } else {
      hasErrors = true;
      console.log(`${import_picocolors3.default.red("\u2716")} ${import_picocolors3.default.bold(check.name)}: ${check.message}`);
    }
  }
  console.log("");
  if (hasErrors) {
    logger.error("Doctor checks found errors that need attention.");
  } else {
    logger.success("All doctor checks passed cleanly!");
  }
}

// src/cli/commands/watch.ts
var import_fs11 = __toESM(require("fs"));
async function watchCommand() {
  const configStore = new ConfigStore();
  const syncEngine = new SyncEngine(configStore);
  const configPath = configStore.getConfigPath();
  if (!import_fs11.default.existsSync(configPath)) {
    logger.error(`Central config file not found at ${configPath}. Run "agent-config init" first.`);
    return;
  }
  logger.heading(`\u{1F440} Watching central config for changes: ${configPath}`);
  logger.info("Press Ctrl+C to stop watching.");
  let debounceTimer = null;
  import_fs11.default.watch(configPath, (eventType) => {
    if (eventType === "change") {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        logger.info("Central config file change detected! Auto-resyncing...");
        const results = await syncEngine.sync();
        for (const res of results) {
          if (res.action !== "unchanged" && res.success) {
            logger.success(`Auto-synced ${res.toolName}`);
          }
        }
      }, 500);
    }
  });
}

// src/cli/commands/export.ts
var import_fs12 = __toESM(require("fs"));
var import_path11 = __toESM(require("path"));
var import_crypto3 = __toESM(require("crypto"));
var import_prompts3 = __toESM(require("prompts"));
async function exportCommand(outFilePath) {
  const configStore = new ConfigStore();
  const keychain = new KeychainManager();
  if (!configStore.exists()) {
    logger.error('Central config store does not exist. Run "agent-config init" first.');
    return;
  }
  const passRes = await (0, import_prompts3.default)({
    type: "password",
    name: "password",
    message: "Set encryption password for exported bundle:",
    validate: (val) => val && val.length >= 6 ? true : "Password must be at least 6 characters"
  });
  if (!passRes.password) {
    logger.warn("Export cancelled.");
    return;
  }
  const config = configStore.read();
  const secrets = {};
  for (const [provider, pConfig] of Object.entries(config.providers)) {
    const secret = await keychain.getSecret(pConfig.keychainRef);
    if (secret) {
      secrets[provider] = secret;
    }
  }
  const bundle = {
    config,
    secrets,
    exportedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const salt = import_crypto3.default.randomBytes(16);
  const key = import_crypto3.default.pbkdf2Sync(passRes.password, salt, 1e5, 32, "sha256");
  const iv = import_crypto3.default.randomBytes(12);
  const cipher = import_crypto3.default.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(JSON.stringify(bundle), "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  const payload = {
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    tag: authTag,
    content: encrypted
  };
  const targetPath = outFilePath || import_path11.default.join(process.cwd(), "agent-config-bundle.enc");
  import_fs12.default.writeFileSync(targetPath, JSON.stringify(payload, null, 2), "utf8");
  logger.success(`Encrypted configuration bundle exported to: ${targetPath}`);
}

// src/cli/commands/import.ts
var import_fs13 = __toESM(require("fs"));
var import_crypto4 = __toESM(require("crypto"));
var import_prompts4 = __toESM(require("prompts"));
async function importCommand(bundlePath) {
  const targetPath = bundlePath || "agent-config-bundle.enc";
  if (!import_fs13.default.existsSync(targetPath)) {
    logger.error(`Bundle file not found at: ${targetPath}`);
    return;
  }
  const passRes = await (0, import_prompts4.default)({
    type: "password",
    name: "password",
    message: "Enter encryption password for bundle:",
    validate: (val) => val && val.length > 0 ? true : "Password required"
  });
  if (!passRes.password) {
    logger.warn("Import cancelled.");
    return;
  }
  try {
    const raw = import_fs13.default.readFileSync(targetPath, "utf8");
    const payload = JSON.parse(raw);
    const salt = Buffer.from(payload.salt, "hex");
    const iv = Buffer.from(payload.iv, "hex");
    const authTag = Buffer.from(payload.tag, "hex");
    const key = import_crypto4.default.pbkdf2Sync(passRes.password, salt, 1e5, 32, "sha256");
    const decipher = import_crypto4.default.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(payload.content, "hex", "utf8");
    decrypted += decipher.final("utf8");
    const bundle = JSON.parse(decrypted);
    const configStore = new ConfigStore();
    const keychain = new KeychainManager();
    configStore.write(bundle.config);
    for (const [provider, secret] of Object.entries(bundle.secrets || {})) {
      if (typeof secret === "string") {
        const ref = await keychain.setSecret(provider, secret);
        bundle.config.providers[provider] = {
          ...bundle.config.providers[provider],
          keychainRef: ref
        };
      }
    }
    configStore.write(bundle.config);
    logger.success("Successfully imported configuration store and secrets into keychain.");
    logger.info('Run "agent-config sync" to push imported settings to your local AI coding tools.');
  } catch (err) {
    logger.error(`Failed to decrypt or import bundle: ${err.message}`);
  }
}

// src/cli/index.ts
var program = new import_commander.Command();
program.name("agent-config").description("Universal single source of truth configuration sync tool for AI coding agents").version("0.1.0");
program.command("init").description("Interactive setup and auto-detection of installed AI coding agent tools").action(initCommand);
program.command("add [provider]").description("Add or update an API key in OS Keychain for an AI provider").action(addCommand);
program.command("sync").description("Push central configuration and secrets to all detected AI agent tools").option("--dry-run", "Show what changes would be made without writing files").option("--tools <list>", "Comma-separated list of tool IDs to sync (e.g. cursor,cline)").option("--project", "Include per-project overrides from .agent-config.json").action(syncCommand);
program.command("status").description("Show status of providers, key storage, and drift across installed tools").action(statusCommand);
program.command("doctor").description("Validate API key formats, permissions, and diagnostic health").action(doctorCommand);
program.command("watch").description("Daemon mode: auto-resync when central config file changes").action(watchCommand);
program.command("export [file]").description("Export encrypted configuration bundle for transfer between machines").action(exportCommand);
program.command("import [file]").description("Import encrypted configuration bundle").action(importCommand);
program.parse(process.argv);
//# sourceMappingURL=index.js.map