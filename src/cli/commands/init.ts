import prompts from 'prompts';
import { ConfigStore } from '../../core/config-store';
import { KeychainManager } from '../../core/keychain';
import { getAllAdapters } from '../../adapters';
import { logger } from '../utils/logger';

export async function initCommand(): Promise<void> {
  logger.heading('🚀 Initializing Universal Agent Config Sync');

  const configStore = new ConfigStore();
  const keychain = new KeychainManager();

  // Detect installed tools
  const adapters = getAllAdapters();
  const installedTools: string[] = [];

  for (const adapter of adapters) {
    if (await adapter.isInstalled()) {
      installedTools.push(adapter.id);
      logger.success(`Detected ${adapter.name} (${adapter.getConfigPath()})`);
    }
  }

  if (installedTools.length === 0) {
    logger.warn('No AI coding agent tools were detected automatically, but all adapters remain available.');
  }

  const response = await prompts([
    {
      type: 'select',
      name: 'provider',
      message: 'Select your primary AI provider to configure:',
      choices: [
        { title: 'Anthropic (Claude)', value: 'anthropic' },
        { title: 'OpenAI (ChatGPT/Codex)', value: 'openai' },
        { title: 'Google Gemini', value: 'google' },
        { title: 'Ollama (Local)', value: 'ollama' },
        { title: 'OpenRouter', value: 'openrouter' },
      ],
    },
    {
      type: 'password',
      name: 'apiKey',
      message: (prev) => `Enter your ${prev} API Key:`,
      validate: (val) => (val && val.trim().length > 0 ? true : 'API key cannot be empty'),
    },
    {
      type: 'text',
      name: 'defaultModel',
      message: 'Default model choice (optional):',
      initial: 'claude-3-7-sonnet-20250219',
    },
  ]);

  if (!response.provider || !response.apiKey) {
    logger.warn('Initialization aborted.');
    return;
  }

  const ref = await keychain.setSecret(response.provider, response.apiKey.trim());
  
  const config = configStore.read();
  config.providers[response.provider] = {
    keychainRef: ref,
    defaultModel: response.defaultModel,
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
