import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { api } from '../services/api.js';
import { useCart } from '../context/CartContext.jsx';
import { useCurrentUser } from '../hooks/useCurrentUser.js';
import { Button } from '../components/ui/Button.jsx';
import { openRazorpayModal } from '../utils/razorpay.js';

const FIELDS = [
  { name: 'fullName', label: 'Full Name' },
  { name: 'phone', label: 'Phone' },
  { name: 'line1', label: 'Address Line 1' },
  { name: 'line2', label: 'Address Line 2 (optional)', optional: true },
  { name: 'city', label: 'City' },
  { name: 'state', label: 'State' },
  { name: 'postalCode', label: 'Postal Code' },
];

export const Checkout = () => {
  const [searchParams] = useSearchParams();
  const agentSessionId = searchParams.get('agentSession');

  const { activeItems, subtotal, clearCart } = useCart();
  const { user, loading: userLoading } = useCurrentUser();
  const navigate = useNavigate();
  const [placing, setPlacing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('razorpay');
  const [selectedAddressId, setSelectedAddressId] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      fullName: '',
      phone: '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    },
  });

  useEffect(() => {
    if (userLoading) {
      reset();
      return;
    }

    const defaultAddr = user?.addresses?.find((savedAddress) => savedAddress.isDefault)
      || user?.addresses?.[0];

    if (defaultAddr) {
      setSelectedAddressId(defaultAddr._id);
      reset({
        fullName: defaultAddr.fullName || '',
        phone: defaultAddr.phone || '',
        line1: defaultAddr.line1 || '',
        line2: defaultAddr.line2 || '',
        city: defaultAddr.city || '',
        state: defaultAddr.state || '',
        postalCode: defaultAddr.postalCode || '',
        country: defaultAddr.country || 'India',
      });
    } else {
      reset({
        fullName: user?.name || '',
        phone: user?.phone || '',
        line1: '',
        line2: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'India',
      });
    }
  }, [reset, user, userLoading]);

  const selectSavedAddress = (addr) => {
    setSelectedAddressId(addr._id);
    reset({
      fullName: addr.fullName || '',
      phone: addr.phone || '',
      line1: addr.line1 || '',
      line2: addr.line2 || '',
      city: addr.city || '',
      state: addr.state || '',
      postalCode: addr.postalCode || '',
      country: addr.country || 'India',
    });
  };

  if (activeItems.length === 0 && !agentSessionId) {
    return (
      <div className="container-page flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-2xl font-semibold text-ink-900 dark:text-white">Your bag is empty</h1>
        <p className="text-sm text-ink-500">
          Browse our collections and items you add will appear here.
        </p>
        <Button as={Link} to="/products">
          Continue shopping
        </Button>
      </div>
    );
  }

  const shippingPrice = subtotal >= 2000 ? 0 : 99;
  const merchantGroups = Object.values(activeItems.reduce((groups, item) => {
    const merchantId = item.product.merchant?._id || item.product.merchant || 'unassigned';
    groups[merchantId] = groups[merchantId] || [];
    groups[merchantId].push(item);
    return groups;
  }, {}));
  const totalShippingPrice = merchantGroups.reduce((total, group) => {
    const groupSubtotal = group.reduce((sum, item) => sum + (item.product.discountPrice || item.product.price) * item.quantity, 0);
    return total + (groupSubtotal >= 2000 ? 0 : 99);
  }, 0);
  const totalAmount = subtotal + (merchantGroups.length > 1 ? totalShippingPrice : shippingPrice);

  const onSubmit = async (shippingAddress) => {
    setPlacing(true);
    const groupedItems = merchantGroups.map((group) => group.map((item) => ({
      productId: item.product._id,
      quantity: item.quantity,
    })));

    if (paymentMethod === 'COD') {
      try {
        const orders = await Promise.all(groupedItems.map((items) => api.post('/orders', { items, shippingAddress })));
        await clearCart();
        toast.success(`${orders.length} order${orders.length === 1 ? '' : 's'} placed via Cash on Delivery!`);
        navigate(`/orders/${orders[0].data.data._id}`);
      } catch (err) {
        toast.error(err.message || 'Failed to place order');
      } finally {
        setPlacing(false);
      }
      return;
    }

    // Each boutique is charged separately so order ownership and settlement remain unambiguous.
    try {
      const createdOrders = [];
      for (const items of groupedItems) {
        const orderRes = await api.post('/payment/create-order', { items, shippingAddress });
        const payment = orderRes.data.data;
        const response = await new Promise((resolve, reject) => openRazorpayModal({
          ...payment,
          customer: shippingAddress,
          onSuccess: resolve,
          onError: reject,
        }));
        const verifyRes = await api.post('/payment/verify', {
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          items,
          shippingAddress,
        });
        createdOrders.push(verifyRes.data.data);
      }
      await clearCart();
      toast.success(`${createdOrders.length} payment${createdOrders.length === 1 ? '' : 's'} verified and order${createdOrders.length === 1 ? '' : 's'} created`);
      navigate(`/orders/${createdOrders[0]._id}`);
    } catch (err) {
      setPlacing(false);
      toast.error(err.message || 'Failed to initiate Razorpay checkout');
    }
  };

  return (
    <div className="container-page py-10">
      {/* Agent Authorization Notice Banner */}
      {agentSessionId && (
        <div className="mb-8 rounded-2xl border border-brand-400 bg-brand-50/80 p-5 dark:border-brand-700 dark:bg-ink-950 shadow-md">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white font-bold text-sm">
              AI
            </span>
            <div>
              <h3 className="font-semibold text-base text-ink-900 dark:text-white">
                Payment Authorization Required
              </h3>
              <p className="mt-0.5 text-xs text-ink-600 dark:text-ink-300">
                An external AI agent initiated this checkout session (<code>{agentSessionId}</code>).
                In accordance with our agentic security architecture, you must explicitly review and authorize the payment.
              </p>
            </div>
          </div>
        </div>
      )}

      <h1 className="mb-6 text-2xl font-semibold text-ink-900 dark:text-white">Checkout</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Delivery Address Section */}
            <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm dark:border-ink-800 dark:bg-ink-950">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-ink-900 dark:text-white">
                  1. Shipping Address
                </h2>
                <Link to="/profile" className="text-xs text-brand-600 hover:underline dark:text-brand-400">
                  Manage Addresses →
                </Link>
              </div>

              {/* Saved Address Quick Selector */}
              {user?.addresses?.length > 0 && (
                <div className="mb-5 pb-5 border-b border-ink-100 dark:border-ink-800">
                  <p className="text-xs font-medium text-ink-500 dark:text-ink-400 mb-2.5">
                    Select a saved address:
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {user.addresses.map((addr) => (
                      <button
                        key={addr._id}
                        type="button"
                        onClick={() => selectSavedAddress(addr)}
                        className={`text-left rounded-xl p-3 border transition text-xs ${
                          selectedAddressId === addr._id
                            ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 font-medium'
                            : 'border-ink-200 hover:border-ink-300 dark:border-ink-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-ink-900 dark:text-white">{addr.fullName}</span>
                          {addr.isDefault && (
                            <span className="text-[10px] bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded px-1.5 py-0.2">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-ink-500 truncate mt-0.5">{addr.line1}, {addr.city}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {FIELDS.map((field) => (
                  <div
                    key={field.name}
                    className={field.name === 'line1' || field.name === 'line2' ? 'sm:col-span-2' : ''}
                  >
                    <label className="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-300">
                      {field.label}
                    </label>
                    <input
                      {...register(field.name, { required: !field.optional })}
                      className="w-full rounded-xl border border-ink-300 px-3.5 py-2 text-sm dark:border-ink-700 dark:bg-ink-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                    {errors[field.name] && (
                      <p className="mt-1 text-xs text-red-500">This field is required</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Method Section */}
            <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm dark:border-ink-800 dark:bg-ink-950">
              <h2 className="text-base font-semibold text-ink-900 dark:text-white mb-4">
                2. Payment Method
              </h2>
              <div className="space-y-3">
                {/* Razorpay Option */}
                <label
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition ${paymentMethod === 'razorpay'
                      ? 'border-brand-500 bg-brand-50/40 dark:border-brand-500 dark:bg-brand-950/20'
                      : 'border-ink-200 hover:border-ink-300 dark:border-ink-800'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment"
                      value="razorpay"
                      checked={paymentMethod === 'razorpay'}
                      onChange={() => setPaymentMethod('razorpay')}
                      className="h-4 w-4 text-brand-500"
                    />
                    <div>
                      <p className="text-sm font-semibold text-ink-900 dark:text-white">
                        Razorpay TEST Gateway
                      </p>
                      <p className="text-xs text-ink-500">
                        Cards, UPI, Netbanking with cryptographic HMAC verification
                      </p>
                    </div>
                  </div>
                  <span className="rounded bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-800 dark:bg-brand-900/40 dark:text-brand-300">
                    RECOMMENDED
                  </span>
                </label>

                {/* COD Option */}
                <label
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition ${paymentMethod === 'COD'
                      ? 'border-brand-500 bg-brand-50/40 dark:border-brand-500 dark:bg-brand-950/20'
                      : 'border-ink-200 hover:border-ink-300 dark:border-ink-800'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment"
                      value="COD"
                      checked={paymentMethod === 'COD'}
                      onChange={() => setPaymentMethod('COD')}
                      className="h-4 w-4 text-brand-500"
                    />
                    <div>
                      <p className="text-sm font-semibold text-ink-900 dark:text-white">
                        Cash on Delivery
                      </p>
                      <p className="text-xs text-ink-500">Pay when your order arrives</p>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <Button type="submit" loading={placing} className="w-full py-3.5 text-sm font-semibold">
              {paymentMethod === 'razorpay'
                ? `Authorize & Pay ₹${totalAmount.toFixed(2)} (Razorpay TEST)`
                : 'Place Order (Cash on Delivery)'}
            </Button>
          </form>
        </div>

        {/* Order Summary Sidebar */}
        <aside className="h-fit rounded-2xl border border-ink-200 bg-white p-6 shadow-sm dark:border-ink-800 dark:bg-ink-950 space-y-5">
          <h2 className="font-semibold text-base text-ink-900 dark:text-white">Order Summary</h2>

          <ul className="divide-y divide-ink-100 dark:divide-ink-800 max-h-60 overflow-y-auto pr-1">
            {activeItems.map((item) => (
              <li key={item.product._id} className="flex justify-between py-2.5 text-xs">
                <span className="text-ink-700 dark:text-ink-300 truncate max-w-50">
                  {item.product.name} <span className="text-ink-400">× {item.quantity}</span>
                </span>
                <span className="font-medium text-ink-900 dark:text-white">
                  ₹{(item.product.discountPrice || item.product.price) * item.quantity}
                </span>
              </li>
            ))}
          </ul>

          <div className="space-y-2 border-t border-ink-200 pt-4 text-xs dark:border-ink-800">
            <div className="flex justify-between text-ink-500">
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-ink-500">
              <span>Shipping</span>
              <span>{shippingPrice === 0 ? 'Free' : `₹${shippingPrice}`}</span>
            </div>
            <div className="flex justify-between font-bold text-sm text-ink-900 dark:text-white pt-2 border-t border-ink-100 dark:border-ink-800">
              <span>Total Amount</span>
              <span className="text-brand-600 dark:text-brand-400">₹{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="rounded-xl bg-ink-50 p-3 text-[11px] text-ink-500 dark:bg-ink-900 flex items-center gap-2">
            <svg className="h-4 w-4 text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Razorpay TEST mode with backend HMAC verification</span>
          </div>
        </aside>
      </div>
    </div>
  );
};
