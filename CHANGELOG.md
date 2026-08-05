# Changelog

## 0.1.0 (2026-08-05)

### Initial Release

- Core central configuration store (`~/.agent-config/config.json`) with per-project override support (`.agent-config.json`).
- Secure OS Keychain storage (`keytar`) with AES-256-GCM encrypted file vault fallback for CI/headless systems.
- Pluggable adapter architecture with native support for:
  - **Cursor** (`settings.json` and `state.vscdb`)
  - **Claude Code** (`settings.json` and `~/.claude.json`)
  - **Cline** (`providers.json`)
  - **Codex CLI** (`config.toml`)
  - **Windsurf** (`settings.json` and `mcp_config.json`)
  - **Continue.dev** (`config.yaml` / `config.json`)
- Safety mechanisms:
  - Non-destructive deep-merge configuration preservation
  - Automatic timestamped backup creation (`.bak`) before writes
  - Secret string redaction across logs, dry-run output, and diagnostic checks
  - Manual edit drift detection and conflict warning engine
- Comprehensive CLI commands: `init`, `add`, `sync [--dry-run]`, `status`, `doctor`, `watch`, `export`, and `import`.
