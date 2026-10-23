import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: ['./lib/licensing/db/schema.ts', './lib/feedback/db/schema.ts', './lib/agreements/db/schema.ts'],
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
