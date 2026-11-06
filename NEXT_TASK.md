# Current task

Completed: file-backed server notice in login response; Node build and all 48 tests pass. No seeds, migrations or Mongo writes were run. Deploy data/server-notice.json beside dist; edit enabled/title/message/news/upcomingEvents there. Next: Blueprint hookup and two-client checks in companion UE docs/FEEDBACK_CHAT_BLUEPRINT_RU.md. Later roadmap work (AI/loot/etc.) is outside this patch.

Follow-up complete: names used for Whisper are validated without whitespace on registration/rename; unchanged legacy names are preserved. Build and 50 tests pass. Multi-server chat transport is not implemented because the current game world runs on one UE server.
