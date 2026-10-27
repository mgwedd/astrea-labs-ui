'use client';

import { useEffect, useState } from 'react';

/** The URL hash without '#', kept current on hashchange. Empty on the server and first render. */
export function useHash() {
  const [hash, setHash] = useState('');
  useEffect(() => {
    const read = () => setHash(window.location.hash.slice(1));
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  return hash;
}
