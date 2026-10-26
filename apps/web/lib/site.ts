export const site = {
  name: 'Astrea Labs',
  legalName: 'Astrea Labs LLC',
  url: 'https://astrealabs.com',
  description:
    'An independent lab building AI research tools, autonomous systems, and security software.',
  founder: 'Michael Wedd',
  team: [
    { name: 'Michael Wedd', github: 'mgwedd' },
    { name: 'Christopher Wedd', github: 'KingMoonk' },
  ],
  github: 'https://github.com/mgwedd',
  /** About-page copy, shared with its markdown version. */
  about: {
    title: 'A small, independent lab',
    intro:
      'Astrea Labs LLC is Michael and Christopher Wedd. We work and experiment together across AI research, autonomous systems and security.',
    body: 'The common thread is control: tools that run on hardware you own, keep data where it was created, and are specified carefully enough to trust. That shows up as on-device clinical AI, from-scratch model training, orbital tracking, and agent tooling with a single credentialed gate.',
  },
  nav: [
    { href: '/projects', label: 'Projects' },
    { href: '/writing', label: 'Writing' },
    { href: '/research', label: 'Research' },
    { href: '/downloads', label: 'Downloads' },
    { href: '/about', label: 'About' },
  ],
} as const;
