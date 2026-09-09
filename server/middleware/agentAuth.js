import crypto from 'crypto';
import AgentApiKey from '../models/AgentApiKey.js';
import Merchant from '../models/Merchant.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const hashApiKey = (key) => {
  return crypto.createHash('sha256').update(key).digest('hex');
};

export const generateApiKey = () => {
  const rawKey = `lx_live_${crypto.randomBytes(24).toString('hex')}`;
  const keyPrefix = rawKey.slice(0, 12);
  const keyHash = hashApiKey(rawKey);
  return { rawKey, keyPrefix, keyHash };
};

export const requireAgentAuth = asyncHandler(async (req, res, next) => {
  const headerKey = req.headers['x-agent-key'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');

  if (!headerKey) {
    throw new ApiError(401, 'Agent API key is required. Provide X-Agent-Key header or Bearer token.');
  }

  const keyHash = hashApiKey(headerKey.trim());
  const apiKeyDoc = await AgentApiKey.findOne({ keyHash, isActive: true });

  if (!apiKeyDoc) {
    throw new ApiError(401, 'Invalid or revoked Agent API key');
  }

  const merchant = await Merchant.findById(apiKeyDoc.merchant);
  if (!merchant || merchant.status !== 'active') {
    throw new ApiError(403, 'Merchant store is inactive or not found');
  }

  // Record usage timestamp without blocking response
  AgentApiKey.findByIdAndUpdate(apiKeyDoc._id, { lastUsedAt: new Date() }).catch(console.error);

  req.agent = apiKeyDoc;
  req.merchant = merchant;
  req.merchantId = merchant._id;
  next();
});

export const requireAgentScope = (requiredScope) => {
  return (req, res, next) => {
    if (!req.agent) {
      return next(new ApiError(401, 'Agent authentication required'));
    }
    if (!req.agent.permissions.includes(requiredScope)) {
      return next(new ApiError(403, `Permission denied. Scope '${requiredScope}' required.`));
    }
    next();
  };
};
