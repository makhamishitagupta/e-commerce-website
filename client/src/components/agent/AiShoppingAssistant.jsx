import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../../services/api.js';
import { useCart } from '../../context/CartContext.jsx';
import { useCurrentUser } from '../../hooks/useCurrentUser.js';
import { openRazorpayModal } from '../../utils/razorpay.js';

export const AiShoppingAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "Welcome to LuxeStyle. I can help you find pieces, explore curated bundles, or check out — just ask.",
      type: 'text',
      suggestions: ['Show me bundles', 'Silk dresses', 'What\'s new?', 'Checkout'],
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { activeItems, addItem, isAuthenticated, subtotal } = useCart();
  const { user } = useCurrentUser();
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    setInput('');
    const userMsg = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await api.post('/chat/message', {
        message: text,
        conversationHistory: messages.slice(-6),
        cartItems: activeItems,
      });

      const data = res.data.data;
      const assistantMsg = {
        role: 'assistant',
        content: data.message,
        type: data.type,
        products: data.products || [],
        bundles: data.bundles || [],
        suggestions: data.suggestions || [],
        checkoutData: data.checkoutData || null,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (data.action && data.action.type === 'ADD_ITEM') {
        const added = await addItem(data.action.product, data.action.quantity || 1);
        if (added) toast.success(`Added ${data.action.product.name} to bag!`);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "I wasn't able to reach the catalog right now. Please try again in a moment.",
          type: 'text',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBundleToBag = async (bundle) => {
    let added = false;
    for (const item of bundle.products) {
      if (item.product) added = (await addItem(item.product, 1)) || added;
    }
    if (added) toast.success(`Bundle "${bundle.title}" added to your bag!`);
  };

  const handleInitiateRazorpayPayment = async () => {
    if (!isAuthenticated) {
      navigate('/checkout');
      return;
    }
    if (activeItems.length === 0) {
      toast.error('Your bag is empty');
      return;
    }

    const defaultAddress = user?.addresses?.find((a) => a.isDefault) || user?.addresses?.[0];
    if (!defaultAddress) {
      toast('Please enter your shipping address at checkout to complete your order.', { icon: '📦' });
      navigate('/checkout');
      return;
    }

    const loadToast = toast.loading('Initiating checkout…');
    try {
      const items = activeItems.map((item) => ({
        productId: item.product._id,
        quantity: item.quantity,
      }));

      const orderRes = await api.post('/payment/create-order', {
        items,
        shippingAddress: defaultAddress,
      });

      const { orderId, amount, currency, keyId } = orderRes.data.data;
      toast.dismiss(loadToast);

      await openRazorpayModal({
        orderId,
        amount,
        currency,
        keyId,
        customer: defaultAddress,
        onSuccess: async (rzpResponse) => {
          const verifyToast = toast.loading('Verifying payment…');
          try {
            const verifyRes = await api.post('/payment/verify', {
              razorpay_order_id: rzpResponse.razorpay_order_id,
              razorpay_payment_id: rzpResponse.razorpay_payment_id,
              razorpay_signature: rzpResponse.razorpay_signature,
              items,
              shippingAddress: defaultAddress,
              isAgentOrder: true,
              agentOrigin: 'ai_assistant',
            });

            toast.dismiss(verifyToast);
            toast.success('Order placed!');
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: `Order #${verifyRes.data.data._id.slice(-8).toUpperCase()} confirmed. Thank you for shopping with LuxeStyle.`,
                type: 'text',
                suggestions: ['View my orders', 'Continue shopping'],
              },
            ]);
            navigate(`/orders/${verifyRes.data.data._id}`);
          } catch (verErr) {
            toast.dismiss(verifyToast);
            toast.error(verErr.message || 'Verification failed');
          }
        },
        onError: (err) => {
          toast.error(err.message || 'Payment cancelled');
        },
      });
    } catch (err) {
      toast.dismiss(loadToast);
      toast.error(err.message || 'Failed to initiate payment');
    }
  };

  const shippingPrice = subtotal >= 2000 ? 0 : 99;
  const totalAmount = subtotal + shippingPrice;

  return (
    <>
      {/* ── FAB ──────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen((o) => !o)}
          className={`group inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 ${
            isOpen
              ? 'bg-ink-100 text-ink-900 dark:bg-ink-800 dark:text-white'
              : 'bg-ink-900 text-white dark:bg-white dark:text-ink-900'
          }`}
          aria-label="Toggle AI Concierge"
        >
          {isOpen ? (
            <CloseIcon />
          ) : (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
            </span>
          )}
          <span>{isOpen ? 'Close' : 'AI Concierge'}</span>
        </button>
      </div>

      {/* ── Chat drawer ──────────────────────────────────── */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[560px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xl animate-slide-up dark:border-ink-800 dark:bg-ink-950">

          {/* Header – mirrors the Navbar glass bar */}
          <header className="glass flex items-center gap-3 border-b border-ink-200/70 px-4 py-3 dark:border-ink-700/70">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-900 text-white dark:bg-white dark:text-ink-900">
              <SparkleIcon />
            </div>
            <div className="flex-1">
              <p className="font-display text-sm font-semibold tracking-tight text-ink-900 dark:text-white">
                LUXE<span className="text-brand-500">STYLE</span>
                <span className="ml-1 font-sans text-[11px] font-normal text-ink-400">Concierge</span>
              </p>
            </div>
            {activeItems.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
                {activeItems.length}
              </span>
            )}
          </header>

          {/* Messages */}
          <div className="flex-1 space-y-3.5 overflow-y-auto px-4 py-4 text-[13px]">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                {/* Bubble */}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900'
                      : 'border border-ink-200 bg-white text-ink-700 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-200'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>

                {/* ── Product cards — mirrors ProductCard thumbnail + price */}
                {msg.products && msg.products.length > 0 && (
                  <div className="mt-2.5 w-full space-y-2">
                    {msg.products.map((p) => (
                      <div
                        key={p._id}
                        className="flex items-center gap-3 rounded-2xl border border-ink-200 p-2.5 transition hover:border-ink-400 dark:border-ink-800 dark:hover:border-ink-600"
                      >
                        <div className="h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-ink-100 dark:bg-ink-800 flex items-center justify-center">
                          {p.images?.[0]?.url ? (
                            <img
                              src={p.images[0].url}
                              alt={p.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-semibold text-brand-600">LX</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-ink-900 dark:text-white">
                            {p.name}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-ink-900 dark:text-white">
                              ₹{(p.discountPrice || p.price).toLocaleString()}
                            </span>
                            {p.discountPrice && (
                              <span className="text-[11px] text-ink-400 line-through">₹{p.price}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (await addItem(p, 1)) toast.success(`Added to bag`);
                          }}
                          className="shrink-0 rounded-full bg-ink-900 px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-ink-700 active:scale-95 dark:bg-white dark:text-ink-900 dark:hover:bg-ink-100"
                        >
                          + Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Bundle cards — mirrors promo banner aesthetic */}
                {msg.bundles && msg.bundles.length > 0 && (
                  <div className="mt-2.5 w-full space-y-2">
                    {msg.bundles.map((b) => (
                      <div
                        key={b._id}
                        className="rounded-2xl bg-brand-50 p-3.5 dark:bg-brand-900/20"
                      >
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                            Bundle · Save {b.discountPercentage}%
                          </span>
                          <span className="text-xs font-semibold text-ink-900 dark:text-white">
                            ₹{b.bundlePrice.toLocaleString()}
                          </span>
                        </div>
                        <h4 className="mt-1.5 text-xs font-semibold text-ink-900 dark:text-white">
                          {b.title}
                        </h4>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-ink-500 dark:text-ink-400">
                          {b.description}
                        </p>
                        <button
                          onClick={() => handleAddBundleToBag(b)}
                          className="mt-2.5 w-full rounded-full bg-ink-900 py-2 text-[11px] font-medium text-white transition hover:bg-ink-700 active:scale-95 dark:bg-white dark:text-ink-900 dark:hover:bg-ink-100"
                        >
                          Add bundle to bag
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Checkout — mirrors Checkout.jsx order-summary sidebar */}
                {msg.checkoutData && (
                  <div className="mt-2.5 w-full rounded-2xl border border-ink-200 p-4 dark:border-ink-800">
                    <h4 className="text-xs font-semibold text-ink-900 dark:text-white">Order Summary</h4>

                    <div className="mt-3 space-y-2 border-t border-ink-200 pt-3 text-xs dark:border-ink-800">
                      <div className="flex justify-between text-ink-500">
                        <span>Subtotal ({activeItems.length} items)</span>
                        <span>₹{subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-ink-500">
                        <span>Shipping</span>
                        <span>{shippingPrice === 0 ? 'Free' : `₹${shippingPrice}`}</span>
                      </div>
                      <div className="flex justify-between border-t border-ink-100 pt-2 text-sm font-bold text-ink-900 dark:border-ink-800 dark:text-white">
                        <span>Total</span>
                        <span className="text-brand-600 dark:text-brand-400">₹{totalAmount.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl bg-ink-50 p-2.5 dark:bg-ink-900">
                      <div className="flex items-center gap-2 text-[11px] text-ink-500">
                        <LockIcon />
                        <span>Razorpay TEST · HMAC-verified</span>
                      </div>
                    </div>

                    <button
                      onClick={handleInitiateRazorpayPayment}
                      className="mt-3 w-full rounded-full bg-ink-900 py-2.5 text-xs font-semibold text-white transition hover:bg-ink-700 active:scale-95 dark:bg-white dark:text-ink-900 dark:hover:bg-ink-100"
                    >
                      Pay ₹{totalAmount.toFixed(2)}
                    </button>
                  </div>
                )}

                {/* ── Quick replies — mirrors ProductCard hover + link styles */}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {msg.suggestions.map((chip, cIdx) => (
                      <button
                        key={cIdx}
                        onClick={() => handleSendMessage(chip)}
                        className="rounded-full border border-ink-300 px-3 py-1 text-[11px] font-medium text-ink-600 transition hover:border-ink-900 hover:text-ink-900 dark:border-ink-700 dark:text-ink-300 dark:hover:border-white dark:hover:text-white"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-1.5 py-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400 dark:bg-ink-500"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input — mirrors Footer email input styling */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="border-t border-ink-200 p-3 dark:border-ink-800"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything…"
                className="w-full rounded-full border border-ink-300 bg-white px-4 py-2 text-sm outline-none focus:border-ink-900 dark:border-ink-700 dark:bg-ink-800 dark:text-white dark:focus:border-white"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-900 text-white transition hover:bg-ink-700 disabled:opacity-40 disabled:hover:bg-ink-900 active:scale-95 dark:bg-white dark:text-ink-900 dark:hover:bg-ink-100"
              >
                <ArrowIcon />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

/* ── Icons (same stroke weight/style as Navbar icons) ──── */

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.286L13 21l-2.286-6.857L5 12l5.714-2.286L13 3z"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}
