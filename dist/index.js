"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  BaseAdapter: () => BaseAdapter,
  ClaudeCodeAdapter: () => ClaudeCodeAdapter,
  ClineAdapter: () => ClineAdapter,
  CodexCLIAdapter: () => CodexCLIAdapter,
  ConfigStore: () => ConfigStore,
  ContinueAdapter: () => ContinueAdapter,
  CursorAdapter: () => CursorAdapter,
  KeychainManager: () => KeychainManager,
  SyncEngine: () => SyncEngine,
  WindsurfAdapter: () => WindsurfAdapter,
  createBackup: () => createBackup,
  getAdapterById: () => getAdapterById,
  getAllAdapters: () => getAllAdapters,
  maskSecret: () => maskSecret,
  maskSecretsInText: () => maskSecretsInText
});
module.exports = __toCommonJS(index_exports);

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
function maskSecretsInText(text, secrets) {
  let sanitized = text;
  for (const secret of secrets) {
    if (secret && secret.length > 5) {
      const masked = maskSecret(secret);
      sanitized = sanitized.split(secret).join(masked);
    }
  }
  return sanitized;
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
function getAdapterById(id) {
  return getAllAdapters().find((a) => a.id === id);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BaseAdapter,
  ClaudeCodeAdapter,
  ClineAdapter,
  CodexCLIAdapter,
  ConfigStore,
  ContinueAdapter,
  CursorAdapter,
  KeychainManager,
  SyncEngine,
  WindsurfAdapter,
  createBackup,
  getAdapterById,
  getAllAdapters,
  maskSecret,
  maskSecretsInText
});
//# sourceMappingURL=index.js.map