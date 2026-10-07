import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.js') ? [join(dir, e.name)] : []); }
for (const file of [...files('src'), ...files('test')]) { const r = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' }); if (r.status) process.exit(r.status); }
console.log('JavaScript syntax checks passed.');
