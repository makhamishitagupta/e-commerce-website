import mongoose from 'mongoose';

const merchantSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    storeName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true },
    logo: { type: String },
    contactEmail: { type: String, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true },
    businessCategory: { type: String, default: 'Fashion & Luxury' },
    status: { type: String, enum: ['active', 'pending', 'suspended'], default: 'active' },
    settings: {
      allowAgentCheckout: { type: Boolean, default: true },
      maxDiscountPercent: { type: Number, default: 25 },
      currency: { type: String, default: 'INR' },
      autoApproveBundles: { type: Boolean, default: false },
    },
    metrics: {
      totalRevenue: { type: Number, default: 0 },
      totalOrders: { type: Number, default: 0 },
      agentRevenue: { type: Number, default: 0 },
      agentOrders: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export default mongoose.model('Merchant', merchantSchema);
