import fs from 'fs';
import crypto from 'crypto';
import prompts from 'prompts';
import { ConfigStore } from '../../core/config-store';
import { KeychainManager } from '../../core/keychain';
import { logger } from '../utils/logger';

export async function importCommand(bundlePath?: string): Promise<void> {
  const targetPath = bundlePath || 'agent-config-bundle.enc';

  if (!fs.existsSync(targetPath)) {
    logger.error(`Bundle file not found at: ${targetPath}`);
    return;
  }

  const passRes = await prompts({
    type: 'password',
    name: 'password',
    message: 'Enter encryption password for bundle:',
    validate: (val) => (val && val.length > 0 ? true : 'Password required'),
  });

  if (!passRes.password) {
    logger.warn('Import cancelled.');
    return;
  }

  try {
    const raw = fs.readFileSync(targetPath, 'utf8');
    const payload = JSON.parse(raw);

    const salt = Buffer.from(payload.salt, 'hex');
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.tag, 'hex');

    const key = crypto.pbkdf2Sync(passRes.password, salt, 100000, 32, 'sha256');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(payload.content, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    const bundle = JSON.parse(decrypted);

    const configStore = new ConfigStore();
    const keychain = new KeychainManager();

    configStore.write(bundle.config);

    for (const [provider, secret] of Object.entries(bundle.secrets || {})) {
      if (typeof secret === 'string') {
        const ref = await keychain.setSecret(provider, secret);
        bundle.config.providers[provider] = {
          ...bundle.config.providers[provider],
          keychainRef: ref,
        };
      }
    }

    configStore.write(bundle.config);
    logger.success('Successfully imported configuration store and secrets into keychain.');
    logger.info('Run "agent-config sync" to push imported settings to your local AI coding tools.');
  } catch (err) {
    logger.error(`Failed to decrypt or import bundle: ${(err as Error).message}`);
  }
}
