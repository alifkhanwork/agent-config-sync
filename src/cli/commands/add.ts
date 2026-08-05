import prompts from 'prompts';
import { ConfigStore } from '../../core/config-store';
import { KeychainManager } from '../../core/keychain';
import { logger } from '../utils/logger';
import { maskSecret } from '../../core/secret-masker';

export async function addCommand(providerName?: string): Promise<void> {
  const configStore = new ConfigStore();
  const keychain = new KeychainManager();

  let provider = providerName?.toLowerCase();

  if (!provider) {
    const res = await prompts({
      type: 'text',
      name: 'provider',
      message: 'Enter provider name (e.g. anthropic, openai, google, openrouter):',
      validate: (val) => (val && val.trim().length > 0 ? true : 'Provider name required'),
    });
    provider = res.provider?.toLowerCase();
  }

  if (!provider) {
    logger.warn('No provider specified. Aborted.');
    return;
  }

  const keyRes = await prompts({
    type: 'password',
    name: 'apiKey',
    message: `Enter API key for ${provider}:`,
    validate: (val) => (val && val.trim().length > 0 ? true : 'API key cannot be empty'),
  });

  if (!keyRes.apiKey) {
    logger.warn('Operation cancelled.');
    return;
  }

  const modelRes = await prompts({
    type: 'text',
    name: 'defaultModel',
    message: `Default model for ${provider} (optional):`,
  });

  const ref = await keychain.setSecret(provider, keyRes.apiKey.trim());

  const config = configStore.read();
  config.providers[provider] = {
    keychainRef: ref,
    defaultModel: modelRes.defaultModel || config.providers[provider]?.defaultModel,
  };

  configStore.write(config);

  logger.success(`Added/Updated provider "${provider}" with key (${maskSecret(keyRes.apiKey)})`);
  logger.info(`Run 'agent-config sync' to push changes.`);
}
