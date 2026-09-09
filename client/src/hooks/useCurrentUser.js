import { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { api } from '../services/api.js';
import { isClerkConfigured } from '../utils/constants.js';

/** Fetches the synced Mongo user (role, addresses, wishlist, cart) for the signed-in Clerk session. */
export const useCurrentUser = () => {
  const { isSignedIn, isLoaded } = useAuth();
  const { user: clerkUser } = useUser();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;

    const demoRole = !isClerkConfigured && typeof window !== 'undefined'
      ? localStorage.getItem('luxestyle-demo-role')
      : null;

    if (!isSignedIn) {
      if (demoRole === 'admin' || demoRole === 'merchant') {
        api
          .get('/users/me')
          .then((res) => setUser(res.data.data))
          .catch(() => setUser({ role: demoRole, name: demoRole === 'admin' ? 'Administrator' : 'Merchant' }))
          .finally(() => setLoading(false));
        return;
      }
      setUser(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    api
      .get('/users/me')
      .then((res) => {
        if (!cancelled) {
          const u = res.data.data;
          setUser(u);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, isLoaded, clerkUser]);

  const effectiveSignedIn = isSignedIn;

  return { user, loading, isSignedIn: effectiveSignedIn, isLoaded };
};
