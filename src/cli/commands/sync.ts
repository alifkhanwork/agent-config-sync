import { SyncEngine } from '../../core/sync-engine';
import { logger } from '../utils/logger';

export interface SyncCommandOptions {
  dryRun?: boolean;
  tools?: string;
  project?: boolean;
}

export async function syncCommand(cmdOptions: SyncCommandOptions): Promise<void> {
  const syncEngine = new SyncEngine();

  const toolList = cmdOptions.tools ? cmdOptions.tools.split(',').map((t) => t.trim()) : undefined;
  const projectPath = cmdOptions.project ? process.cwd() : undefined;

  if (cmdOptions.dryRun) {
    logger.heading('🔍 Running Sync in Dry-Run Mode (No files will be modified)');
  } else {
    logger.heading('🔄 Synchronizing AI Agent Configurations');
  }

  const results = await syncEngine.sync({
    dryRun: cmdOptions.dryRun,
    tools: toolList,
    projectPath,
  });

  let anyChanged = false;

  for (const result of results) {
    if (!result.success) {
      logger.error(`${result.toolName}: Error - ${result.error}`);
      continue;
    }

    if (result.action === 'unchanged') {
      logger.subtle(`${result.toolName}: Up-to-date (${result.filePath})`);
    } else {
      anyChanged = true;
      const tag = cmdOptions.dryRun ? '[DRY-RUN WOULD WRITE]' : '[UPDATED]';
      logger.success(`${result.toolName} ${tag} -> ${result.filePath}`);
      for (const change of result.changes) {
        console.log(`    └─ ${change}`);
      }
    }
  }

  if (!anyChanged && !cmdOptions.dryRun) {
    logger.info('All target tool configurations are already in sync!');
  } else if (cmdOptions.dryRun) {
    logger.info("Run 'agent-config sync' without --dry-run to apply these changes.");
  }
}
