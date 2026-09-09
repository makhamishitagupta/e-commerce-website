/**
 * Dynamically loads the Razorpay checkout script
 */
export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

/**
 * Launches the official Razorpay Checkout popup
 */
export const openRazorpayModal = async ({
  orderId,
  amount, // in paise
  currency = 'INR',
  keyId,
  customer = {},
  allowSimulation = false,
  onSuccess,
  onError,
}) => {
  if (!keyId || !orderId || !Number.isInteger(Number(amount)) || Number(amount) <= 0) {
    if (onError) onError(new Error('Razorpay checkout configuration is incomplete. Please retry.'));
    return;
  }

  const loaded = await loadRazorpayScript();
  if (!loaded) {
    if (onError) onError(new Error('Failed to load Razorpay payment gateway script.'));
    return;
  }

  const options = {
    key: keyId,
    amount,
    currency,
    name: 'LuxeStyle Luxury Commerce',
    description: 'Order Payment (TEST Mode)',
    order_id: orderId,
    prefill: {
      name: customer.fullName || '',
      email: customer.email || '',
      contact: customer.phone || '',
    },
    theme: {
      color: '#a67c3d', // LuxeStyle brand color
    },
    handler: function (response) {
      // response contains { razorpay_payment_id, razorpay_order_id, razorpay_signature }
      if (onSuccess) onSuccess(response);
    },
    modal: {
      ondismiss: function () {
        if (onError) onError(new Error('Payment window closed by user'));
      },
    },
  };

  try {
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response) {
      const description = response.error?.description || 'Payment failed';
      const message = /international cards are not supported/i.test(description)
        ? 'This Razorpay account does not support international cards. Use an Indian Test Mode card, UPI, netbanking, or wallet instead.'
        : description;
      if (onError) onError(new Error(message));
    });
    rzp.open();
  } catch (err) {
    if (!allowSimulation) {
      if (onError) onError(new Error('Razorpay Checkout could not open. Check the Test Mode key and browser network access.'));
      return;
    }

    // Local simulation is allowed only when the backend explicitly reports no Razorpay credentials.
    console.warn('[razorpay] Modal invocation error, using simulation fallback:', err);
    if (window.confirm(`[Razorpay TEST Gateway Simulation]\nOrder ID: ${orderId}\nAmount: ₹${(amount / 100).toFixed(2)}\n\nClick OK to simulate successful test payment authorization.`)) {
      if (onSuccess) {
        onSuccess({
          razorpay_order_id: orderId,
          razorpay_payment_id: `pay_sim_${Date.now()}`,
          razorpay_signature: `sig_valid_${orderId}`,
        });
      }
    } else {
      if (onError) onError(new Error('Payment cancelled by user'));
    }
  }
};
