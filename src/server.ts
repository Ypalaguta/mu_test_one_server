import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDatabase, repository } from './shared/database.js';
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
await connectDatabase();
const server = createApp(repository, () => mongoose.connection.readyState === 1)
  .listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Game data API listening on port ${port}`));
server.on('error', async (err: Error) => { console.error(err.message); await mongoose.disconnect(); process.exitCode = 1; });
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(async () => { await mongoose.disconnect(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
