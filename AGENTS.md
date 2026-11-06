# Working agreements

- Read PROJECT_STATE.md and NEXT_TASK.md; inspect git status and preserve user edits.
- Russian explanations, English code and game messages. Keep changes scoped to the requested feature.
- Never read/print .env secrets, reset MongoDB, run seeds or add migrations without necessity.
- Use npm.cmd run build and npm.cmd test; tests use fixtures, not the running database.
- UE owns live gameplay/chat; Node owns account/data persistence. No persistent chat history.
