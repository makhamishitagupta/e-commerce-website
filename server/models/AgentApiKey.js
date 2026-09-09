import mongoose from 'mongoose';

const agentApiKeySchema = new mongoose.Schema(
  {
    merchant: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    keyPrefix: { type: String, required: true },
    keyHash: { type: String, required: true, unique: true, index: true },
    permissions: [
      {
        type: String,
        enum: ['catalog:read', 'cart:write', 'checkout:write', 'analytics:read'],
        default: ['catalog:read', 'cart:write', 'checkout:write'],
      },
    ],
    lastUsedAt: { type: Date },
    isActive: { type: Boolean, default: true },
    createdByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

agentApiKeySchema.index({ merchant: 1, isActive: 1 });

export default mongoose.model('AgentApiKey', agentApiKeySchema);
