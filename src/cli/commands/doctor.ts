import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { ConfigStore } from '../../core/config-store';
import { KeychainManager } from '../../core/keychain';
import { getAllAdapters } from '../../adapters';
import { logger } from '../utils/logger';
import { DoctorCheckResult } from '../../core/types';
import { maskSecret } from '../../core/secret-masker';

export async function doctorCommand(): Promise<void> {
  logger.heading('🩺 Running Agent Config Doctor Checks');

  const configStore = new ConfigStore();
  const keychain = new KeychainManager();
  const checks: DoctorCheckResult[] = [];

  // Check 1: Central config store existence
  if (configStore.exists()) {
    checks.push({
      name: 'Central Config File',
      status: 'ok',
      message: `Found at ${configStore.getConfigPath()}`,
    });
  } else {
    checks.push({
      name: 'Central Config File',
      status: 'warn',
      message: `Not initialized. Run "agent-config init" to create it.`,
    });
  }

  // Check 2: Keychain subsystem
  if (keychain.isNativeSupported()) {
    checks.push({
      name: 'Keychain Storage',
      status: 'ok',
      message: 'Using OS Native Keychain (keytar)',
    });
  } else {
    checks.push({
      name: 'Keychain Storage',
      status: 'warn',
      message: 'Native keytar unavailable; using encrypted file vault (AES-256-GCM fallback)',
    });
  }

  // Check 3: Provider API key validity checks
  const config = configStore.read();
  for (const [provider, pConfig] of Object.entries(config.providers)) {
    const key = await keychain.getSecret(pConfig.keychainRef);
    if (!key) {
      checks.push({
        name: `Provider: ${provider}`,
        status: 'error',
        message: `Missing API key in keychain (${pConfig.keychainRef})`,
      });
    } else if (key.length < 10) {
      checks.push({
        name: `Provider: ${provider}`,
        status: 'warn',
        message: `API key seems suspiciously short (${maskSecret(key)})`,
      });
    } else {
      checks.push({
        name: `Provider: ${provider}`,
        status: 'ok',
        message: `Key valid & secure (${maskSecret(key)})`,
      });
    }
  }

  // Check 4: Tool configuration directory write permissions
  const adapters = getAllAdapters();
  for (const adapter of adapters) {
    const filePath = adapter.getConfigPath();
    const dirPath = path.dirname(filePath);

    if (fs.existsSync(dirPath)) {
      try {
        fs.accessSync(dirPath, fs.constants.W_OK);
        checks.push({
          name: `Tool Directory: ${adapter.name}`,
          status: 'ok',
          message: `Writable (${dirPath})`,
        });
      } catch {
        checks.push({
          name: `Tool Directory: ${adapter.name}`,
          status: 'error',
          message: `Permission denied writing to ${dirPath}`,
        });
      }
    }
  }

  // Display Doctor Summary
  let hasErrors = false;
  for (const check of checks) {
    if (check.status === 'ok') {
      console.log(`${pc.green('✔')} ${pc.bold(check.name)}: ${check.message}`);
    } else if (check.status === 'warn') {
      console.log(`${pc.yellow('⚠')} ${pc.bold(check.name)}: ${check.message}`);
    } else {
      hasErrors = true;
      console.log(`${pc.red('✖')} ${pc.bold(check.name)}: ${check.message}`);
    }
  }

  console.log('');
  if (hasErrors) {
    logger.error('Doctor checks found errors that need attention.');
  } else {
    logger.success('All doctor checks passed cleanly!');
  }
}
