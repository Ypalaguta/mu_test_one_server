# Project state

2026-11-12: Renamed spellDamage to spellDamageInc in schema and fixtures; readStats accepts legacy spellDamage, with explicit spellDamageInc taking precedence. Ran tools/rename-spell-damage-inc.mjs: 514 catalog documents migrated and verified with values preserved. Backup: backups/spell-damage-inc-1794435537106.json. Build and 58 tests passed.

2026-11-12: Added eight reserved defense increases to statFields/schema and JSON fixtures (armorInc, evasionInc, magicEvasionInc, magicResistInc, fireResInc, coldResInc, lightningResInc, chaosResInc). These are not yet used by UE formulas. tools/migrate-defense-stats.mjs added missing increases and spellDamageFlat with zero defaults in Mongo and removed obsolete quantity/rarity/exp/gold only from stat blocks. Verified all 514 catalog documents against their pre-migration snapshots with only expected changes. Backup: backups/defense-stats-1794434700696.json (ignored by Git). No character/account data changed. Build and 57 tests passed.

Node 24, TypeScript, Express, MongoDB. Account login validates credentials and returns safe account, character snapshots and session token. UE relays requests using game-server authentication. Existing admin item endpoint revalidates the account session and permissions.

2026-11-05 patch: optional data/server-notice.json is loaded for successful logins, without Mongo schema changes. UE handles live chat/combat feedback. Existing user changes and deleted README files are preserved.

Chat nickname update: registration and changed names in snapshot saves reject whitespace/control characters (1..64 characters). Existing names are not migrated; unchanged legacy names remain saveable. UE handles prefix parsing, per-connection Shout limits and online Whisper delivery; there is no inter-server chat broker. Node build and all 50 tests passed.
