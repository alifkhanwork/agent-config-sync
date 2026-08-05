import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const SERVICE_NAME = 'agent-config-sync';

// Dynamic optional import for keytar
let keytarModule: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  keytarModule = require('keytar');
} catch {
  keytarModule = null;
}

export class KeychainManager {
  private fallbackVaultPath: string;
  private vaultKeyPath: string;

  constructor(customDir?: string) {
    const baseDir = customDir || path.join(os.homedir(), '.agent-config');
    this.fallbackVaultPath = path.join(baseDir, '.vault.enc');
    this.vaultKeyPath = path.join(baseDir, '.vault.key');
  }

  public isNativeSupported(): boolean {
    return keytarModule !== null;
  }

  /**
   * Saves a secret to the native keychain (or encrypted fallback vault).
   * Returns a keychain reference string, e.g. "agent-config-sync:openai"
   */
  public async setSecret(account: string, secret: string): Promise<string> {
    const ref = `${SERVICE_NAME}:${account}`;

    if (this.isNativeSupported()) {
      try {
        await keytarModule.setPassword(SERVICE_NAME, account, secret);
        return ref;
      } catch {
        // Fall back to encrypted vault if native call fails
      }
    }

    await this.setVaultSecret(account, secret);
    return ref;
  }

  /**
   * Retrieves a secret by its keychain reference or account name.
   */
  public async getSecret(refOrAccount: string): Promise<string | null> {
    const account = refOrAccount.replace(`${SERVICE_NAME}:`, '');

    if (this.isNativeSupported()) {
      try {
        const secret = await keytarModule.getPassword(SERVICE_NAME, account);
        if (secret) return secret;
      } catch {
        // Fall back to encrypted vault
      }
    }

    return this.getVaultSecret(account);
  }

  /**
   * Deletes a secret from keychain / vault.
   */
  public async deleteSecret(refOrAccount: string): Promise<boolean> {
    const account = refOrAccount.replace(`${SERVICE_NAME}:`, '');

    let deleted = false;
    if (this.isNativeSupported()) {
      try {
        deleted = await keytarModule.deletePassword(SERVICE_NAME, account);
      } catch {
        // Ignore
      }
    }

    const vaultDeleted = await this.deleteVaultSecret(account);
    return deleted || vaultDeleted;
  }

  // --- Encrypted File Vault Fallback (AES-256-GCM) ---

  private getOrCreateVaultMasterKey(): Buffer {
    if (!fs.existsSync(path.dirname(this.vaultKeyPath))) {
      fs.mkdirSync(path.dirname(this.vaultKeyPath), { recursive: true });
    }

    if (fs.existsSync(this.vaultKeyPath)) {
      const keyHex = fs.readFileSync(this.vaultKeyPath, 'utf8').trim();
      return Buffer.from(keyHex, 'hex');
    }

    // Generate machine-bound key seed + random bytes
    const machineFingerprint = `${os.hostname()}-${os.userInfo().username}-${os.arch()}`;
    const salt = crypto.randomBytes(16);
    const masterKey = crypto.pbkdf2Sync(machineFingerprint, salt, 100000, 32, 'sha256');

    fs.writeFileSync(this.vaultKeyPath, masterKey.toString('hex'), { mode: 0o600 });
    return masterKey;
  }

  private readVault(): Record<string, string> {
    if (!fs.existsSync(this.fallbackVaultPath)) {
      return {};
    }

    try {
      const masterKey = this.getOrCreateVaultMasterKey();
      const raw = fs.readFileSync(this.fallbackVaultPath, 'utf8');
      const payload = JSON.parse(raw);

      const iv = Buffer.from(payload.iv, 'hex');
      const authTag = Buffer.from(payload.tag, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(payload.content, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch {
      return {};
    }
  }

  private writeVault(data: Record<string, string>): void {
    if (!fs.existsSync(path.dirname(this.fallbackVaultPath))) {
      fs.mkdirSync(path.dirname(this.fallbackVaultPath), { recursive: true });
    }

    const masterKey = this.getOrCreateVaultMasterKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);

    const text = JSON.stringify(data);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    const payload = {
      iv: iv.toString('hex'),
      tag: authTag,
      content: encrypted,
    };

    fs.writeFileSync(this.fallbackVaultPath, JSON.stringify(payload, null, 2), { mode: 0o600 });
  }

  private async setVaultSecret(account: string, secret: string): Promise<void> {
    const vault = this.readVault();
    vault[account] = secret;
    this.writeVault(vault);
  }

  private async getVaultSecret(account: string): Promise<string | null> {
    const vault = this.readVault();
    return vault[account] || null;
  }

  private async deleteVaultSecret(account: string): Promise<boolean> {
    const vault = this.readVault();
    if (account in vault) {
      delete vault[account];
      this.writeVault(vault);
      return true;
    }
    return false;
  }
}
