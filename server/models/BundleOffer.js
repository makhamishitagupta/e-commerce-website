import mongoose from 'mongoose';

const bundleItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    discountRate: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false }
);

const bundleOfferSchema = new mongoose.Schema(
  {
    merchant: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    bundleType: {
      type: String,
      enum: ['bundle', 'combo', 'cross_sell', 'frequently_bought_together'],
      default: 'bundle',
    },
    products: {
      type: [bundleItemSchema],
      validate: (v) => v.length >= 2,
    },
    originalPrice: { type: Number, required: true, min: 0 },
    bundlePrice: { type: Number, required: true, min: 0 },
    discountPercentage: { type: Number, required: true, min: 0, max: 100 },
    metrics: {
      support: { type: Number, default: 0 },
      confidence: { type: Number, default: 0 },
      lift: { type: Number, default: 1 },
      coPurchaseCount: { type: Number, default: 0 },
    },
    aiRationale: { type: String },
    status: {
      type: String,
      enum: ['suggested', 'approved', 'rejected', 'archived'],
      default: 'suggested',
      index: true,
    },
    approvedAt: { type: Date },
    timesPurchased: { type: Number, default: 0 },
  },
  { timestamps: true }
);

bundleOfferSchema.index({ merchant: 1, status: 1 });

export default mongoose.model('BundleOffer', bundleOfferSchema);
