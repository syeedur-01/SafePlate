import { useEffect, useState } from 'react';

/** Returns true once `loading` has stayed true for `ms` milliseconds. */
export function useSlowNotice(loading: boolean, ms = 8000): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(timer);
  }, [loading, ms]);

  return slow;
}
