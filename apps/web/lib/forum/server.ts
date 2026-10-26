import 'server-only';
import { getDb } from '@/lib/licensing/db/client';
import type { Db, Deps } from './service';

/** Production dependencies for the forum services. The Neon client's schema only affects relational queries, which the forum does not use. */
export const forumDeps = (): Deps => ({ db: getDb() as unknown as Db });
