import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const claims = JSON.parse(readFileSync(new URL('../.factory/claims.json', import.meta.url), 'utf8'));
for (const claim of claims) {
  process.stdout.write(`\nRunning claim ${claim.id}\n`);
  execSync(claim.test, { stdio: 'inherit', shell: true });
}
