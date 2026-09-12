import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { Button } from '../components/ui/Button.jsx';

const FREE_SHIPPING_THRESHOLD = 2000;
const SHIPPING_FEE = 99;

export const Cart = () => {
  const { activeItems, subtotal, updateQuantity, removeItem } = useCart();

  if (activeItems.length === 0) {
    return (
      <div className="container-page flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-2xl font-semibold text-ink-900 dark:text-white">Your cart is empty</h1>
        <p className="text-sm text-ink-500 dark:text-ink-400">
          Browse the shop and items you add will show up here.
        </p>
        <Button as={Link} to="/products">
          Continue shopping
        </Button>
      </div>
    );
  }

  const shippingPrice = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const totalAmount = subtotal + shippingPrice;
  const freeShippingProgress = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));
  const amountNeeded = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  return (
    <div className="container-page py-10">
      <h1 className="mb-6 text-2xl font-semibold text-ink-900 dark:text-white">Your Cart</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          {/* Free Shipping Notification */}
          <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-900 dark:bg-brand-950/20">
            <div className="flex items-center justify-between text-xs font-medium text-brand-800 dark:text-brand-300 mb-2">
              <span>
                {subtotal >= FREE_SHIPPING_THRESHOLD
                  ? '🎉 You unlocked FREE Shipping!'
                  : `Add ₹${amountNeeded.toFixed(2)} more to qualify for FREE Shipping`}
              </span>
              <span>{freeShippingProgress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-brand-100 dark:bg-ink-800">
              <div
                className="h-full bg-brand-500 transition-all duration-300"
                style={{ width: `${freeShippingProgress}%` }}
              />
            </div>
          </div>

          <ul className="divide-y divide-ink-200 dark:divide-ink-800 rounded-2xl border border-ink-200 bg-white p-4 shadow-sm dark:border-ink-800 dark:bg-ink-950">
            {activeItems.map((item) => {
              const maxStock = item.product.stock || 1;
              const unitPrice = item.product.discountPrice || item.product.price;
              const lineTotal = unitPrice * item.quantity;

              return (
                <li key={item.product._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 first:pt-2 last:pb-2">
                  <div className="flex items-center gap-4">
                    <img
                      src={item.product.images?.[0]?.url}
                      alt={item.product.name}
                      className="h-20 w-16 rounded-xl object-cover shrink-0 bg-ink-100 dark:bg-ink-900"
                    />
                    <div>
                      <Link
                        to={`/products/${item.product.slug}`}
                        className="font-medium text-ink-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400 transition"
                      >
                        {item.product.name}
                      </Link>
                      <p className="text-sm font-semibold text-ink-700 dark:text-ink-300 mt-0.5">
                        ₹{unitPrice.toFixed(2)}
                      </p>
                      {item.product.stock <= 5 && (
                        <p className="text-xs text-red-500 mt-1">Only {item.product.stock} left in stock</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6">
                    {/* Stepper */}
                    <div className="flex items-center rounded-xl border border-ink-300 bg-ink-50 dark:border-ink-700 dark:bg-ink-900">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        disabled={item.quantity <= 1}
                        onClick={() => updateQuantity(item.product._id, Math.max(1, item.quantity - 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-l-xl text-ink-700 hover:bg-ink-200 disabled:opacity-40 dark:text-ink-300 dark:hover:bg-ink-800 transition"
                      >
                        −
                      </button>
                      <span className="w-10 text-center text-sm font-medium text-ink-900 dark:text-white">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        disabled={item.quantity >= maxStock}
                        onClick={() => updateQuantity(item.product._id, Math.min(maxStock, item.quantity + 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-r-xl text-ink-700 hover:bg-ink-200 disabled:opacity-40 dark:text-ink-300 dark:hover:bg-ink-800 transition"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right min-w-[70px]">
                      <p className="text-sm font-semibold text-ink-900 dark:text-white">
                        ₹{lineTotal.toFixed(2)}
                      </p>
                      <button
                        onClick={() => removeItem(item.product._id)}
                        className="text-xs text-red-500 hover:underline mt-0.5"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="h-fit rounded-2xl border border-ink-200 bg-white p-6 shadow-sm dark:border-ink-800 dark:bg-ink-950 space-y-4">
          <h2 className="font-semibold text-base text-ink-900 dark:text-white">Order Summary</h2>
          <div className="space-y-2 border-t border-ink-100 dark:border-ink-800 pt-3 text-sm">
            <div className="flex justify-between text-ink-600 dark:text-ink-400">
              <span>Subtotal</span>
              <span className="font-medium text-ink-900 dark:text-white">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-ink-600 dark:text-ink-400">
              <span>Estimated Shipping</span>
              <span className="font-medium text-ink-900 dark:text-white">
                {shippingPrice === 0 ? <span className="text-green-600 dark:text-green-400">Free</span> : `₹${shippingPrice}`}
              </span>
            </div>
            <div className="flex justify-between text-base font-bold text-ink-900 dark:text-white border-t border-ink-100 dark:border-ink-800 pt-3">
              <span>Total Amount</span>
              <span className="text-brand-600 dark:text-brand-400">₹{totalAmount.toFixed(2)}</span>
            </div>
          </div>
          <Button as={Link} to="/checkout" className="w-full py-3 text-sm font-semibold">
            Proceed to Checkout
          </Button>
        </aside>
      </div>
    </div>
  );
};
