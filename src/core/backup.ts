import fs from 'fs';
import path from 'path';

/**
 * Creates a backup copy of a configuration file before modifying it.
 * Example: 'settings.json' -> 'settings.json.2026-08-05_103000.bak'
 */
export async function createBackup(filePath: string): Promise<string | null> {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '')
    .replace('T', '_')
    .slice(0, 15); // e.g. 20260805_103000

  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);

  const backupFileName = `${baseName}.${timestamp}.bak${ext}`;
  const backupPath = path.join(dir, backupFileName);

  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}
