import Razorpay from 'razorpay';
import crypto from 'crypto';

let razorpayInstance = null;

const isConfigured = Boolean(
  process.env.RAZORPAY_KEY_ID &&
    !process.env.RAZORPAY_KEY_ID.includes('REPLACE') &&
    process.env.RAZORPAY_KEY_SECRET &&
    !process.env.RAZORPAY_KEY_SECRET.includes('REPLACE')
);
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

if (isConfigured) {
  try {
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  } catch (err) {
    console.warn('[razorpay] Initialization warning:', err.message);
  }
}

export const isRazorpayConfigured = () => isConfigured;

export const getRazorpayKeyId = () => {
  return process.env.RAZORPAY_KEY_ID || null;
};

export const getRazorpayKeySecret = () => {
  return process.env.RAZORPAY_KEY_SECRET || null;
};

/**
 * Creates a Razorpay order in TEST mode (or fallback sandbox test order with valid schema)
 */
export const createRazorpayOrder = async ({ amount, currency = 'INR', receipt, notes = {} }) => {
  const amountInPaise = Math.round(amount * 100);

  if (razorpayInstance) {
    try {
      const order = await razorpayInstance.orders.create({
        amount: amountInPaise,
        currency,
        receipt: receipt || `rcpt_${Date.now()}`,
        notes,
      });
      return {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
      };
    } catch (err) {
      console.error('[razorpay] Error calling Razorpay API:', err);
      const description = err?.error?.description || err?.message || 'Unknown Razorpay error';
      throw new Error(`Razorpay order creation failed: ${description}`);
    }
  }

  if (isConfigured) {
    throw new Error('Razorpay Test Mode order creation failed. Check the server credentials and network connection.');
  }

  throw new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env.');
};

/**
 * Cryptographically verifies the Razorpay payment signature using HMAC SHA-256
 */
export const verifyRazorpaySignature = ({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) => {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return false;
  }

  const secret = getRazorpayKeySecret();
  if (!secret) return false;
  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');

  return expectedSignature === razorpay_signature;
};

export const verifyRazorpayWebhookSignature = (rawBody, signature) => {
  if (!webhookSecret || !rawBody || !signature) return false;
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};
