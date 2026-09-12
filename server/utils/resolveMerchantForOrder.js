import Merchant from '../models/Merchant.js';
import { ApiError } from './ApiError.js';

export const resolveSingleActiveMerchant = async (products) => {
  const merchantIds = [...new Set(products.map((p) => p.merchant?.toString()).filter(Boolean))];
  if (merchantIds.length === 0) {
    throw new ApiError(400, 'Could not resolve an active merchant for this order');
  }
  if (merchantIds.length > 1) {
    throw new ApiError(400, 'Checkout can only include items from one boutique. Remove other items first.');
  }
  const merchant = await Merchant.findOne({ _id: merchantIds[0], status: 'active' });
  if (!merchant) throw new ApiError(400, 'Could not resolve an active merchant for this order');
  return merchant;
};
