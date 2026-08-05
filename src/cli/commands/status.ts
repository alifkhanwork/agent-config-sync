import Table from 'cli-table3';
import pc from 'picocolors';
import { ConfigStore } from '../../core/config-store';
import { SyncEngine } from '../../core/sync-engine';
import { KeychainManager } from '../../core/keychain';
import { logger } from '../utils/logger';
import { maskSecret } from '../../core/secret-masker';

export async function statusCommand(): Promise<void> {
  const configStore = new ConfigStore();
  const keychain = new KeychainManager();
  const syncEngine = new SyncEngine(configStore, keychain);

  logger.heading('📊 Central Config & Provider Status');

  const config = configStore.read();
  const providersTable = new Table({
    head: [pc.cyan('Provider'), pc.cyan('Keychain Ref'), pc.cyan('Secret Status'), pc.cyan('Default Model')],
  });

  for (const [provider, pConfig] of Object.entries(config.providers)) {
    const key = await keychain.getSecret(pConfig.keychainRef);
    const secretDisplay = key ? pc.green(`Present (${maskSecret(key)})`) : pc.red('Missing from Keychain');
    providersTable.push([provider, pConfig.keychainRef, secretDisplay, pConfig.defaultModel || '(default)']);
  }

  if (Object.keys(config.providers).length === 0) {
    console.log(pc.gray('  No providers configured yet. Run "agent-config add <provider>" to add one.'));
  } else {
    console.log(providersTable.toString());
  }

  logger.heading('🛠 Target Tool Sync & Drift Status');

  const driftStatuses = await syncEngine.getDriftStatus();
  const toolsTable = new Table({
    head: [pc.cyan('Tool'), pc.cyan('Installed'), pc.cyan('Config File Path'), pc.cyan('Sync Status')],
  });

  for (const status of driftStatuses) {
    const installedText = status.installed ? pc.green('Yes') : pc.gray('No');
    let syncStatusText = pc.gray('Not Installed');

    if (status.exists) {
      if (status.drifted) {
        syncStatusText = pc.yellow(`⚠️ Drifted (${status.reason || 'Manual Edits Detected'})`);
      } else {
        syncStatusText = pc.green('✔ In Sync');
      }
    } else if (status.installed) {
      syncStatusText = pc.blue('Pending Sync');
    }

    toolsTable.push([status.toolName, installedText, status.configPath, syncStatusText]);
  }

  console.log(toolsTable.toString());
}
