/**
 * Masks a secret string (e.g., API key) for safe logging and display.
 * Example: 'sk-ant-api03-abcdef123456' -> 'sk-ant-***3456'
 */
export function maskSecret(secret: string | null | undefined): string {
  if (!secret) return '(empty)';
  if (secret.length <= 8) {
    return '***';
  }

  // Preserve prefix if sk-ant- / sk-proj- / etc.
  const prefixLength = secret.startsWith('sk-ant-') ? 7 : secret.startsWith('sk-') ? 3 : 4;
  const suffixLength = 4;

  const prefix = secret.slice(0, prefixLength);
  const suffix = secret.slice(-suffixLength);

  return `${prefix}***${suffix}`;
}

/**
 * Sanitizes arbitrary text output by replacing known secret strings with masked placeholders.
 */
export function maskSecretsInText(text: string, secrets: string[]): string {
  let sanitized = text;
  for (const secret of secrets) {
    if (secret && secret.length > 5) {
      const masked = maskSecret(secret);
      sanitized = sanitized.split(secret).join(masked);
    }
  }
  return sanitized;
}
