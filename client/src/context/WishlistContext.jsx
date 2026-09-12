import { createContext, useContext, useEffect, useMemo, useReducer, useCallback } from 'react';
import { useAuth, useClerk } from '@clerk/clerk-react';
import { api } from '../services/api.js';
import { useCurrentUser } from '../hooks/useCurrentUser.js';

const WishlistContext = createContext(null);

function wishlistReducer(state, action) {
  switch (action.type) {
    case 'SET':
      return action.payload;
    default:
      return state;
  }
}

export const WishlistProvider = ({ children }) => {
  const { isLoaded, isSignedIn } = useAuth();
  const { user, loading: userLoading } = useCurrentUser();
  const { openSignIn } = useClerk();
  const [items, dispatch] = useReducer(wishlistReducer, []);

  useEffect(() => {
    let cancelled = false;
    if (!isLoaded) return undefined;
    if (!isSignedIn || (!userLoading && user?.role !== 'user')) {
      dispatch({ type: 'SET', payload: [] });
      return undefined;
    }
    if (userLoading || !user) return undefined;

    const loadWishlist = async () => {
      let nextItems = [];
      try {
        const response = await api.get('/wishlist');
        nextItems = response.data.data || [];
      } catch {}

      const rawIntent = sessionStorage.getItem('luxestyle-pending-wishlist-item');
      if (rawIntent) {
        try {
          const intent = JSON.parse(rawIntent);
          const response = await api.post(`/wishlist/${intent.productId}`);
          nextItems = response.data.data || nextItems;
        } catch {}
        sessionStorage.removeItem('luxestyle-pending-wishlist-item');
      }

      if (!cancelled) dispatch({ type: 'SET', payload: nextItems });
    };

    loadWishlist();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, user, userLoading]);

  const toggleWishlist = useCallback(async (product) => {
    if (!isSignedIn) {
      sessionStorage.setItem(
        'luxestyle-pending-wishlist-item',
        JSON.stringify({ productId: product._id })
      );
      openSignIn({ redirectUrl: window.location.href });
      return false;
    }
    if (userLoading || user?.role !== 'user') return false;

    const exists = items.some((item) => item._id === product._id);
    const response = exists
      ? await api.delete(`/wishlist/${product._id}`)
      : await api.post(`/wishlist/${product._id}`);
    dispatch({ type: 'SET', payload: response.data.data || [] });
    return true;
  }, [isSignedIn, items, openSignIn, user, userLoading]);

  const removeFromWishlist = useCallback(async (productId) => {
    if (userLoading || user?.role !== 'user') return false;
    const response = await api.delete(`/wishlist/${productId}`);
    dispatch({ type: 'SET', payload: response.data.data || [] });
    return true;
  }, [user, userLoading]);

  const value = useMemo(
    () => ({
      items,
      isWishlisted: (productId) => items.some((item) => item._id === productId),
      toggleWishlist,
      removeFromWishlist,
      clearWishlist: async () => {
        await Promise.all(items.map((item) => api.delete(`/wishlist/${item._id}`)));
        dispatch({ type: 'SET', payload: [] });
      },
    }),
    [items, toggleWishlist, removeFromWishlist]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

export const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within a WishlistProvider');
  return ctx;
};
