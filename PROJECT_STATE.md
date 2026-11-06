# Project state

Node 24, TypeScript, Express, MongoDB. Account login validates credentials and returns safe account, character snapshots and session token. UE relays requests using game-server authentication. Existing admin item endpoint revalidates the account session and permissions.

2026-11-05 patch: optional data/server-notice.json is loaded for successful logins, without Mongo schema changes. UE handles live chat/combat feedback. Existing user changes and deleted README files are preserved.

Chat nickname update: registration and changed names in snapshot saves reject whitespace/control characters (1..64 characters). Existing names are not migrated; unchanged legacy names remain saveable. UE handles prefix parsing, per-connection Shout limits and online Whisper delivery; there is no inter-server chat broker. Node build and all 50 tests passed.
