import { createContext, useContext, useEffect, useMemo, useReducer, useState, useCallback } from 'react';
import { useAuth, useClerk } from '@clerk/clerk-react';
import { api } from '../services/api.js';
import { useCurrentUser } from '../hooks/useCurrentUser.js';

const CartContext = createContext(null);
function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { product, quantity = 1 } = action.payload;
      const existing = state.find((item) => item.product._id === product._id);
      if (existing) {
        return state.map((item) =>
          item.product._id === product._id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...state, { product, quantity, savedForLater: false }];
    }
    case 'REMOVE_ITEM':
      return state.filter((item) => item.product._id !== action.payload.productId);
    case 'UPDATE_QUANTITY':
      return state.map((item) =>
        item.product._id === action.payload.productId
          ? { ...item, quantity: Math.max(1, action.payload.quantity) }
          : item
      );
    case 'SAVE_FOR_LATER':
      return state.map((item) =>
        item.product._id === action.payload.productId
          ? { ...item, savedForLater: !item.savedForLater }
          : item
      );
    case 'CLEAR':
      return [];
    case 'SET':
      return action.payload;
    default:
      return state;
  }
}

export const CartProvider = ({ children }) => {
  const { isLoaded, isSignedIn } = useAuth();
  const { user, loading: userLoading } = useCurrentUser();
  const { openSignIn } = useClerk();
  const [items, dispatch] = useReducer(cartReducer, []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isLoaded) return undefined;
    if (!isSignedIn || (!userLoading && user?.role !== 'user')) {
      dispatch({ type: 'SET', payload: [] });
      return undefined;
    }
    if (userLoading || !user) return undefined;

    setLoading(true);
    const hydrateCart = async () => {
      let nextItems = [];
      try {
        const response = await api.get('/cart');
        nextItems = response.data.data || [];
      } catch {
        nextItems = [];
      }

      const rawIntent = sessionStorage.getItem('luxestyle-pending-cart-item');
      if (rawIntent) {
        try {
          const intent = JSON.parse(rawIntent);
          const response = await api.post('/cart', {
            productId: intent.productId,
            quantity: intent.quantity,
          });
          nextItems = response.data.data || nextItems;
        } catch {}
        sessionStorage.removeItem('luxestyle-pending-cart-item');
      }

      if (!cancelled) {
        dispatch({ type: 'SET', payload: nextItems });
        setLoading(false);
      }
    };
    hydrateCart();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, user, userLoading]);

  const requireSignIn = useCallback((product, quantity) => {
    sessionStorage.setItem(
      'luxestyle-pending-cart-item',
      JSON.stringify({ productId: product._id, quantity })
    );
    openSignIn({ redirectUrl: window.location.href });
  }, [openSignIn]);

  const addItem = useCallback(async (product, quantity = 1) => {
    if (!isSignedIn) {
      requireSignIn(product, quantity);
      return false;
    }
    if (userLoading || user?.role !== 'user') return false;
    const response = await api.post('/cart', { productId: product._id, quantity });
    dispatch({ type: 'SET', payload: response.data.data || [] });
    return true;
  }, [isSignedIn, requireSignIn, user, userLoading]);

  const updateQuantity = useCallback(async (productId, quantity) => {
    if (userLoading || user?.role !== 'user') return false;
    const item = items.find((cartItem) => cartItem.product?._id === productId);
    if (!item) return false;
    const response = await api.put(`/cart/${item._id}`, { quantity });
    dispatch({ type: 'SET', payload: response.data.data || [] });
    return true;
  }, [items, user, userLoading]);

  const removeItem = useCallback(async (productId) => {
    if (userLoading || user?.role !== 'user') return false;
    const item = items.find((cartItem) => cartItem.product?._id === productId);
    if (!item) return false;
    const response = await api.delete(`/cart/${item._id}`);
    dispatch({ type: 'SET', payload: response.data.data || [] });
    return true;
  }, [items, user, userLoading]);

  const toggleSaveForLater = useCallback(async (productId) => {
    if (userLoading || user?.role !== 'user') return false;
    const item = items.find((cartItem) => cartItem.product?._id === productId);
    if (!item) return false;
    const response = await api.put(`/cart/${item._id}`, { savedForLater: !item.savedForLater });
    dispatch({ type: 'SET', payload: response.data.data || [] });
    return true;
  }, [items, user, userLoading]);

  const clearCart = useCallback(async () => {
    try {
      await api.delete('/cart');
    } catch {}
    dispatch({ type: 'CLEAR' });
  }, []);

  const value = useMemo(() => {
    const activeItems = items.filter((item) => !item.savedForLater);
    const subtotal = activeItems.reduce(
      (sum, item) => sum + (item.product.discountPrice || item.product.price) * item.quantity,
      0
    );

    return {
      items,
      loading,
      isAuthenticated: Boolean(isSignedIn),
      activeItems,
      savedItems: items.filter((item) => item.savedForLater),
      itemCount: activeItems.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      addItem,
      removeItem,
      updateQuantity,
      toggleSaveForLater,
      clearCart,
    };
  }, [items, loading, isSignedIn, addItem, removeItem, updateQuantity, toggleSaveForLater, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
};

export const GuestCartProvider = ({ children }) => {
  const value = useMemo(() => ({
    items: [],
    isAuthenticated: false,
    activeItems: [],
    savedItems: [],
    itemCount: 0,
    subtotal: 0,
    addItem: () => Promise.resolve(),
    removeItem: () => {},
    updateQuantity: () => {},
    toggleSaveForLater: () => {},
    clearCart: () => {},
  }), []);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
