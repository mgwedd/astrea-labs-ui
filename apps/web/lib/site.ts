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
  nav: [
    { href: '/projects', label: 'Projects' },
    { href: '/writing', label: 'Writing' },
    { href: '/research', label: 'Research' },
    { href: '/downloads', label: 'Downloads' },
    { href: '/about', label: 'About' },
  ],
} as const;
