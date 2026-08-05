import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import prompts from 'prompts';
import { ConfigStore } from '../../core/config-store';
import { KeychainManager } from '../../core/keychain';
import { logger } from '../utils/logger';

export async function exportCommand(outFilePath?: string): Promise<void> {
  const configStore = new ConfigStore();
  const keychain = new KeychainManager();

  if (!configStore.exists()) {
    logger.error('Central config store does not exist. Run "agent-config init" first.');
    return;
  }

  const passRes = await prompts({
    type: 'password',
    name: 'password',
    message: 'Set encryption password for exported bundle:',
    validate: (val) => (val && val.length >= 6 ? true : 'Password must be at least 6 characters'),
  });

  if (!passRes.password) {
    logger.warn('Export cancelled.');
    return;
  }

  const config = configStore.read();
  const secrets: Record<string, string> = {};

  for (const [provider, pConfig] of Object.entries(config.providers)) {
    const secret = await keychain.getSecret(pConfig.keychainRef);
    if (secret) {
      secrets[provider] = secret;
    }
  }

  const bundle = {
    config,
    secrets,
    exportedAt: new Date().toISOString(),
  };

  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(passRes.password, salt, 100000, 32, 'sha256');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(JSON.stringify(bundle), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  const payload = {
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: authTag,
    content: encrypted,
  };

  const targetPath = outFilePath || path.join(process.cwd(), 'agent-config-bundle.enc');
  fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf8');

  logger.success(`Encrypted configuration bundle exported to: ${targetPath}`);
}
