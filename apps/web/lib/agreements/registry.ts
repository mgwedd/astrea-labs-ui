// Every agreement the site serves, by id. Client-safe.
import { ALETHEIA_BETA } from '@/lib/beta-access/content';
import type { AgreementDefinition } from './define';

// Every definition, both levels. A signed one also needs a `document` spec;
// lib/agreements/signed renders, seals and stores it.
const ALL: AgreementDefinition[] = [ALETHEIA_BETA];

export const AGREEMENTS: ReadonlyMap<string, AgreementDefinition> = new Map(ALL.map((d) => [d.id, d]));

export const getAgreement = (id: string): AgreementDefinition | undefined => AGREEMENTS.get(id);
