import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { useWishlist } from '../../context/WishlistContext.jsx';
import { useCurrentUser } from '../../hooks/useCurrentUser.js';
import { NAV_LINKS, isClerkConfigured } from '../../utils/constants.js';
import { api } from '../../services/api.js';
import { clsx } from 'clsx';

const IconButton = ({ children, ...props }) => (
  <button
    className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-700 transition-all duration-150 hover:scale-110 hover:bg-ink-100 active:scale-90 dark:text-ink-200 dark:hover:bg-ink-800"
    {...props}
  >
    {children}
  </button>
);

const Badge = ({ count }) =>
  count > 0 ? (
    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
      {count > 9 ? '9+' : count}
    </span>
  ) : null;

export const Navbar = () => {
  const { theme, toggleTheme } = useTheme();
  const { itemCount } = useCart();
  const { items: wishlistItems } = useWishlist();
  const { user } = useCurrentUser();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef(null);

  const isAdmin = user?.role === 'admin';
  const isMerchant = user?.role === 'merchant';
  const canAccessMerchant = isAdmin || isMerchant;

  const navLinks = [
    ...NAV_LINKS,
    ...(canAccessMerchant ? [{ label: 'Merchant Portal', to: '/merchant' }] : []),
    ...(isAdmin ? [{ label: 'Admin', to: '/admin' }] : []),
  ];

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      setSearchLoading(true);
      api
        .get(`/products/search?q=${encodeURIComponent(trimmed)}`)
        .then((res) => {
          setSuggestions(res.data?.data || []);
        })
        .catch(() => setSuggestions([]))
        .finally(() => setSearchLoading(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      navigate(`/products?search=${encodeURIComponent(q)}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <header className="glass sticky top-0 z-50 border-b border-ink-200/70 dark:border-ink-700/70">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-700 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-800 lg:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            <MenuIcon />
          </button>
          <Link to="/" className="font-display text-xl font-semibold tracking-tight">
            LUXE<span className="text-brand-500">STYLE</span>
          </Link>
        </div>

        <nav className="hidden items-center gap-8 lg:flex">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                clsx(
                  'text-sm font-medium text-ink-600 transition hover:text-ink-950 dark:text-ink-300 dark:hover:text-white',
                  isActive && 'text-ink-950 dark:text-white'
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <IconButton
            onClick={() => setSearchOpen((prev) => !prev)}
            aria-label="Search"
            title="Search products"
          >
            <SearchIcon />
          </IconButton>
          <IconButton onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </IconButton>
          <Link to="/wishlist" className="relative">
            <IconButton aria-label="Wishlist">
              <HeartIcon />
              <Badge count={wishlistItems.length} />
            </IconButton>
          </Link>
          <Link to="/cart" className="relative">
            <IconButton aria-label="Cart">
              <BagIcon />
              <Badge count={itemCount} />
            </IconButton>
          </Link>

          {isClerkConfigured ? (
            <>
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="ml-2 rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-ink-700 dark:bg-white dark:text-ink-900">
                    Sign in
                  </button>
                </SignInButton>
              </SignedOut>
            </>
          ) : (
            <Link
              to="/profile"
              className="ml-2 rounded-full bg-ink-200 px-4 py-2 text-sm font-medium text-ink-500 dark:bg-ink-800 dark:text-ink-400"
              title="Configure Clerk to enable sign in"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      {/* Interactive Search Overlay & Suggestions */}
      {searchOpen && (
        <div className="border-t border-ink-200 bg-white/95 px-4 py-3 backdrop-blur-md dark:border-ink-800 dark:bg-ink-950/95 shadow-lg animate-slide-up">
          <div className="container-page max-w-3xl">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search luxury fashion, shoes, accessories..."
                  className="w-full rounded-2xl border border-ink-300 bg-ink-50 px-4 py-2.5 pl-11 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:bg-white focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-white dark:focus:bg-ink-900"
                />
                <div className="pointer-events-none absolute left-3.5 top-3 text-ink-400">
                  <SearchIcon />
                </div>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-xs text-ink-400 hover:text-ink-600 dark:hover:text-ink-200"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="rounded-2xl bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="rounded-2xl border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-900"
              >
                Close
              </button>
            </form>

            {/* Live Autocomplete Suggestions */}
            {searchQuery.trim() && (
              <div className="mt-3 divide-y divide-ink-100 rounded-2xl border border-ink-200 bg-white p-2 shadow-md dark:divide-ink-800 dark:border-ink-800 dark:bg-ink-900">
                {searchLoading ? (
                  <div className="p-4 text-center text-xs text-ink-400">Searching catalog…</div>
                ) : suggestions.length === 0 ? (
                  <div className="p-4 text-center text-xs text-ink-500">
                    No matching products found for &ldquo;{searchQuery}&rdquo;. Press Enter to browse full catalog.
                  </div>
                ) : (
                  <>
                    <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                      Suggestions
                    </div>
                    {suggestions.map((p) => (
                      <Link
                        key={p._id}
                        to={`/products/${p.slug}`}
                        onClick={() => {
                          setSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="flex items-center justify-between gap-3 rounded-xl p-2.5 hover:bg-ink-50 dark:hover:bg-ink-800/60 transition"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={p.images?.[0]?.url}
                            alt={p.name}
                            className="h-10 w-8 rounded-md object-cover bg-ink-100 dark:bg-ink-800"
                          />
                          <div>
                            <p className="text-sm font-medium text-ink-900 dark:text-white line-clamp-1">
                              {p.name}
                            </p>
                            <p className="text-xs text-brand-600 dark:text-brand-400 font-semibold">
                              ₹{(p.discountPrice || p.price).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-ink-400">View →</span>
                      </Link>
                    ))}
                    <button
                      type="button"
                      onClick={handleSearchSubmit}
                      className="w-full text-center py-2 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                    >
                      View all results for &ldquo;{searchQuery}&rdquo; →
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-ink-200 px-4 py-3 lg:hidden dark:border-ink-700">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-800"
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
};

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function HeartIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M12 21s-7.5-4.8-10-9.4C.4 8 2 4.5 5.6 4a5.4 5.4 0 016.4 3 5.4 5.4 0 016.4-3c3.6.5 5.2 4 3.6 7.6C19.5 16.2 12 21 12 21z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function BagIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 8h12l-1 12H7L6 8z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 8V6a3 3 0 016 0v2" strokeLinecap="round" />
    </svg>
  );
}
