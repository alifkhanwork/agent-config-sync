import fs from 'fs';
import { ConfigStore } from '../../core/config-store';
import { SyncEngine } from '../../core/sync-engine';
import { logger } from '../utils/logger';

export async function watchCommand(): Promise<void> {
  const configStore = new ConfigStore();
  const syncEngine = new SyncEngine(configStore);
  const configPath = configStore.getConfigPath();

  if (!fs.existsSync(configPath)) {
    logger.error(`Central config file not found at ${configPath}. Run "agent-config init" first.`);
    return;
  }

  logger.heading(`👀 Watching central config for changes: ${configPath}`);
  logger.info('Press Ctrl+C to stop watching.');

  let debounceTimer: NodeJS.Timeout | null = null;

  fs.watch(configPath, (eventType) => {
    if (eventType === 'change') {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        logger.info('Central config file change detected! Auto-resyncing...');
        const results = await syncEngine.sync();
        for (const res of results) {
          if (res.action !== 'unchanged' && res.success) {
            logger.success(`Auto-synced ${res.toolName}`);
          }
        }
      }, 500);
    }
  });
}
