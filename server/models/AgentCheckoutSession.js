import mongoose from 'mongoose';

const checkoutItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    image: { type: String },
  },
  { _id: false }
);

const agentCheckoutSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    cartId: { type: String },
    merchant: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant' },
    agentKey: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentApiKey' },
    customerInfo: {
      fullName: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
    },
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      line1: { type: String, required: true },
      line2: { type: String },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true, default: 'India' },
    },
    items: [checkoutItemSchema],
    itemsPrice: { type: Number, required: true },
    shippingPrice: { type: Number, required: true, default: 0 },
    discountAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    status: {
      type: String,
      enum: ['awaiting_customer_authorization', 'authorized', 'completed', 'expired', 'failed'],
      default: 'awaiting_customer_authorization',
      index: true,
    },
    createdOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

export default mongoose.model('AgentCheckoutSession', agentCheckoutSessionSchema);
