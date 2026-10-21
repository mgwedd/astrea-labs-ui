import type { DomainInfo } from './types';

export const DOMAINS: DomainInfo[] = [
  {
    id: 'ai',
    label: 'AI research',
    description: 'Training models from scratch, on-device inference, and tools for studying how models learn.',
  },
  {
    id: 'autonomy',
    label: 'Drones & aerospace',
    description: 'Orbital mechanics, space domain awareness, and fixes to the open-source flight stacks.',
  },
  {
    id: 'software',
    label: 'Software',
    description: 'Native apps and developer tools, shipped with real release pipelines.',
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Privacy-first design, threat modeling, and audited, least-privilege tooling.',
  },
];

export const getDomain = (id: DomainInfo['id']) => DOMAINS.find((d) => d.id === id)!;
