import mongoose from 'mongoose';

const agentCartItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    image: { type: String },
    sku: { type: String },
  },
  { _id: true }
);

const agentCartSchema = new mongoose.Schema(
  {
    cartId: { type: String, required: true, unique: true, index: true },
    merchant: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant' },
    agentKey: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentApiKey' },
    items: [agentCartItemSchema],
    appliedBundle: { type: mongoose.Schema.Types.ObjectId, ref: 'BundleOffer' },
    bundleDiscount: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    shippingFee: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

agentCartSchema.methods.recalculate = function () {
  this.subtotal = this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  this.shippingFee = this.subtotal >= 2000 || this.subtotal === 0 ? 0 : 99;
  this.totalAmount = Math.max(0, this.subtotal - this.bundleDiscount + this.shippingFee);
};

export default mongoose.model('AgentCart', agentCartSchema);
