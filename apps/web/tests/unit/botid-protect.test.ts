// Every route that calls checkBotId() must be in the client protect list,
// or real browsers send no BotID headers and get a 403.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '../..');
const apiDir = join(root, 'app/api');

const checked = readdirSync(apiDir, { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('route.ts'))
  .filter((f) => readFileSync(join(apiDir, f), 'utf8').includes('checkBotId('))
  .map((f) => `/api/${f.replace(/\\/g, '/').replace(/\/route\.ts$/, '')}`)
  .sort();

const protectedPaths = [
  ...readFileSync(join(root, 'instrumentation-client.ts'), 'utf8').matchAll(/path:\s*'([^']+)'/g),
]
  .map((m) => m[1])
  .sort();

describe('BotID protect list', () => {
  it('finds the checked routes', () => {
    expect(checked.length).toBeGreaterThan(0);
  });

  it('matches the routes that call checkBotId', () => {
    expect(protectedPaths).toEqual(checked);
  });
});
