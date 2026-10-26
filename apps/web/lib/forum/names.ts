// Usernames and random handles. Pure, so the service and tests share them.

const ADJECTIVES = [
  'dancing', 'quiet', 'prancing', 'brave', 'calm', 'clever', 'curious', 'eager', 'gentle', 'golden',
  'happy', 'hidden', 'jolly', 'keen', 'lively', 'lucky', 'mellow', 'nimble', 'noble', 'patient',
  'proud', 'quick', 'restless', 'silver', 'sleepy', 'steady', 'sunny', 'swift', 'tidy', 'wandering',
  'warm', 'wild', 'wise', 'witty', 'amber', 'bright', 'crimson', 'distant', 'electric', 'frosty',
  'gleaming', 'humble', 'ivory', 'lunar', 'misty', 'northern', 'orange', 'plucky', 'rustic', 'stellar',
];
const NOUNS = [
  'stark', 'heron', 'panda', 'falcon', 'otter', 'badger', 'comet', 'cedar', 'harbor', 'lantern',
  'maple', 'meadow', 'orchid', 'pebble', 'quail', 'raven', 'sparrow', 'thistle', 'willow', 'wren',
  'beacon', 'canyon', 'delta', 'ember', 'fjord', 'glacier', 'horizon', 'island', 'juniper', 'kestrel',
  'lagoon', 'marlin', 'nebula', 'osprey', 'prairie', 'quartz', 'reef', 'summit', 'tundra', 'valley',
  'walrus', 'yarrow', 'zephyr', 'aspen', 'bison', 'condor', 'dolphin', 'egret', 'finch', 'gecko',
];

/** A random handle such as `dancing-stark`. `random` returns a float in [0, 1) and is injectable for tests. */
export function randomHandle(random: () => number = Math.random): string {
  const pick = (list: string[]) => list[Math.floor(random() * list.length) % list.length];
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}`;
}

export const HANDLE_PATTERN = /^[a-z]+-[a-z]+(-\d{2,4})?$/;
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,23}$/;
/** Names members cannot take, so nothing can impersonate staff or a broadcast mention. */
export const RESERVED_NAMES = new Set(['admin', 'administrator', 'moderator', 'mod', 'staff', 'astrea', 'astrealabs', 'support', 'everyone', 'here', 'all', 'system']);

export const isValidUsername = (name: string) => USERNAME_PATTERN.test(name) && !RESERVED_NAMES.has(name) && !HANDLE_PATTERN.test(name);

/** A first username from the part of the email before the `@`: lowercase, safe characters, 3 to 20 long. */
export function usernameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  const base = local.toLowerCase().replace(/[^a-z0-9_-]/g, '').replace(/^[-_]+/, '').slice(0, 20);
  const name = base.length >= 3 ? base : `member${base}`.slice(0, 20);
  return RESERVED_NAMES.has(name) || HANDLE_PATTERN.test(name) ? `${name}1` : name;
}
