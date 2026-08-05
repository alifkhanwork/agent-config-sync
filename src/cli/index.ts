import { Command } from 'commander';
import { initCommand } from './commands/init';
import { addCommand } from './commands/add';
import { syncCommand } from './commands/sync';
import { statusCommand } from './commands/status';
import { doctorCommand } from './commands/doctor';
import { watchCommand } from './commands/watch';
import { exportCommand } from './commands/export';
import { importCommand } from './commands/import';

const program = new Command();

program
  .name('agent-config')
  .description('Universal single source of truth configuration sync tool for AI coding agents')
  .version('0.1.0');

program
  .command('init')
  .description('Interactive setup and auto-detection of installed AI coding agent tools')
  .action(initCommand);

program
  .command('add [provider]')
  .description('Add or update an API key in OS Keychain for an AI provider')
  .action(addCommand);

program
  .command('sync')
  .description('Push central configuration and secrets to all detected AI agent tools')
  .option('--dry-run', 'Show what changes would be made without writing files')
  .option('--tools <list>', 'Comma-separated list of tool IDs to sync (e.g. cursor,cline)')
  .option('--project', 'Include per-project overrides from .agent-config.json')
  .action(syncCommand);

program
  .command('status')
  .description('Show status of providers, key storage, and drift across installed tools')
  .action(statusCommand);

program
  .command('doctor')
  .description('Validate API key formats, permissions, and diagnostic health')
  .action(doctorCommand);

program
  .command('watch')
  .description('Daemon mode: auto-resync when central config file changes')
  .action(watchCommand);

program
  .command('export [file]')
  .description('Export encrypted configuration bundle for transfer between machines')
  .action(exportCommand);

program
  .command('import [file]')
  .description('Import encrypted configuration bundle')
  .action(importCommand);

program.parse(process.argv);
