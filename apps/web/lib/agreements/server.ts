import 'server-only';
import { getDb } from '@/lib/licensing/db/client';
import type { Db, Deps } from './service';

// The Neon client's schema only affects relational queries, which this service does not use.
export const agreementDeps = (): Deps => ({ db: getDb() as unknown as Db });
