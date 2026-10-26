// Every agreement the site serves, by id. Client-safe.
import { BETA_FRAME } from '@/lib/beta-access/content';
import type { AgreementDefinition } from './define';

// Every definition, both levels. A signed one also needs a `document` spec;
// lib/agreements/signed renders, seals and stores it. The beta definition is
// the frame: its C1 text names a placeholder version and is never served from here.
const ALL: AgreementDefinition[] = [BETA_FRAME];

export const AGREEMENTS: ReadonlyMap<string, AgreementDefinition> = new Map(ALL.map((d) => [d.id, d]));

export const getAgreement = (id: string): AgreementDefinition | undefined => AGREEMENTS.get(id);
