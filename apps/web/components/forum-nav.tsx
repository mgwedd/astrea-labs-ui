'use client';

import { useEffect, useState } from 'react';

/**
 * True once the server confirms the signed-in visitor may use the forum. Fetched after hydration so
 * the site's pages stay statically rendered; anonymous visitors get `false` and no link.
 */
export function useForumAccess(): boolean {
  const [canUse, setCanUse] = useState(false);
  useEffect(() => {
    let live = true;
    fetch('/api/forum/access', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { canUse: false }))
      .then((d: { canUse?: boolean }) => live && setCanUse(d.canUse === true))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return canUse;
}
