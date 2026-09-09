import { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import { useAuth, useClerk } from '@clerk/clerk-react';
import { api } from '../services/api.js';

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
  const { openSignIn } = useClerk();
  const [items, dispatch] = useReducer(cartReducer, []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isLoaded) return undefined;
    if (!isSignedIn) {
      dispatch({ type: 'SET', payload: [] });
      return undefined;
    }

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
  }, [isLoaded, isSignedIn]);

  const requireSignIn = (product, quantity) => {
    sessionStorage.setItem(
      'luxestyle-pending-cart-item',
      JSON.stringify({ productId: product._id, quantity })
    );
    openSignIn({ redirectUrl: window.location.href });
  };

  const addItem = async (product, quantity = 1) => {
    if (!isSignedIn) {
      requireSignIn(product, quantity);
      return false;
    }
    const response = await api.post('/cart', { productId: product._id, quantity });
    dispatch({ type: 'SET', payload: response.data.data || [] });
    return true;
  };

  const updateQuantity = async (productId, quantity) => {
    const item = items.find((cartItem) => cartItem.product?._id === productId);
    if (!item) return;
    const response = await api.put(`/cart/${item._id}`, { quantity });
    dispatch({ type: 'SET', payload: response.data.data || [] });
  };

  const removeItem = async (productId) => {
    const item = items.find((cartItem) => cartItem.product?._id === productId);
    if (!item) return;
    const response = await api.delete(`/cart/${item._id}`);
    dispatch({ type: 'SET', payload: response.data.data || [] });
  };

  const toggleSaveForLater = async (productId) => {
    const item = items.find((cartItem) => cartItem.product?._id === productId);
    if (!item) return;
    const response = await api.put(`/cart/${item._id}`, { savedForLater: !item.savedForLater });
    dispatch({ type: 'SET', payload: response.data.data || [] });
  };

  const value = useMemo(() => {
    const activeItems = items.filter((item) => !item.savedForLater);
    const subtotal = activeItems.reduce(
      (sum, item) => sum + (item.product.discountPrice || item.product.price) * item.quantity,
      0
    );

    return {
      items,
      isAuthenticated: Boolean(isSignedIn),
      activeItems,
      savedItems: items.filter((item) => item.savedForLater),
      itemCount: activeItems.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      addItem,
      removeItem,
      updateQuantity,
      toggleSaveForLater,
      clearCart: async () => {
        await Promise.all(items.map((item) => api.delete(`/cart/${item._id}`)));
        dispatch({ type: 'CLEAR' });
      },
    };
  }, [items, isSignedIn, isLoaded, loading]);

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
