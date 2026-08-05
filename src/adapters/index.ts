import { BaseAdapter } from './base-adapter';
import { CursorAdapter } from './cursor-adapter';
import { ClaudeCodeAdapter } from './claude-code-adapter';
import { ClineAdapter } from './cline-adapter';
import { CodexCLIAdapter } from './codex-cli-adapter';
import { WindsurfAdapter } from './windsurf-adapter';
import { ContinueAdapter } from './continue-adapter';

export * from './base-adapter';
export * from './cursor-adapter';
export * from './claude-code-adapter';
export * from './cline-adapter';
export * from './codex-cli-adapter';
export * from './windsurf-adapter';
export * from './continue-adapter';

export function getAllAdapters(): BaseAdapter[] {
  return [
    new CursorAdapter(),
    new ClaudeCodeAdapter(),
    new ClineAdapter(),
    new CodexCLIAdapter(),
    new WindsurfAdapter(),
    new ContinueAdapter(),
  ];
}

export function getAdapterById(id: string): BaseAdapter | undefined {
  return getAllAdapters().find((a) => a.id === id);
}
