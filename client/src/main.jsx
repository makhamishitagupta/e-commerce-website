import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { CartProvider, GuestCartProvider } from './context/CartContext.jsx';
import { WishlistProvider } from './context/WishlistContext.jsx';
import { AuthTokenProvider } from './context/AuthTokenProvider.jsx';
import { CLERK_PUBLISHABLE_KEY, isClerkConfigured } from './utils/constants.js';

const AppShell = () => (
  <>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        className: 'text-sm',
      }}
    />
  </>
);

const ConfiguredApp = () => (
  <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
    <AuthTokenProvider>
      <CartProvider>
        <WishlistProvider>
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </WishlistProvider>
      </CartProvider>
    </AuthTokenProvider>
  </ClerkProvider>
);

const UnconfiguredApp = () => (
  <GuestCartProvider>
    <WishlistProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </WishlistProvider>
  </GuestCartProvider>
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      {isClerkConfigured ? <ConfiguredApp /> : <UnconfiguredApp />}
    </ThemeProvider>
  </StrictMode>
);
