import path from 'node:path';
import { promises as fs } from 'node:fs';
import { startServer } from './server.js';
const tls = process.env.MICBRIDGE_TLS_KEY && process.env.MICBRIDGE_TLS_CERT
  ? { key: await fs.readFile(process.env.MICBRIDGE_TLS_KEY, 'utf8'), cert: await fs.readFile(process.env.MICBRIDGE_TLS_CERT, 'utf8') } : undefined;
const server = await startServer({ directory: process.env.MICBRIDGE_DATA ?? path.resolve('.micbridge'), mobilePort: Number(process.env.MICBRIDGE_PORT ?? 8443), setupPort: Number(process.env.MICBRIDGE_SETUP_PORT ?? 8442), tls });
console.log(`Desktop: ${server.localUrl}`);
for (const url of (await server.config()).urls) console.log(`Phone: ${url}`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void server.close().then(() => process.exit(0)); });
