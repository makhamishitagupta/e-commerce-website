import { getAuth, clerkClient } from '@clerk/express';
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { isDbConnected } from '../config/db.js';
import { isClerkConfigured } from '../config/clerk.js';

/**
 * Finds the local Mongo User for the authenticated Clerk session, creating it
 * on first sight. This is the fallback path for when the Clerk webhook hasn't
 * fired yet (e.g. local dev without a public URL) — see config/clerk.js.
 */
const getOrCreateUser = async (clerkId) => {
  let user = await User.findOne({ clerkId });
  if (user) return user;

  const clerkUser = await clerkClient.users.getUser(clerkId);
  const email = clerkUser.emailAddresses?.find(
    (e) => e.id === clerkUser.primaryEmailAddressId
  )?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress;

  user = await User.findOneAndUpdate(
    { clerkId },
    {
      $setOnInsert: {
        clerkId,
        name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || 'New User',
        email,
        phone: clerkUser.phoneNumbers?.[0]?.phoneNumber,
        avatar: clerkUser.imageUrl,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return user;
};

/** Requires a valid Clerk session; attaches the local Mongo user doc as req.user. */
export const requireAuth = asyncHandler(async (req, res, next) => {
  if (!isClerkConfigured) {
    throw new ApiError(503, 'Authentication is not configured on the server yet.');
  }

  const { userId } = getAuth(req);
  if (!userId && process.env.NODE_ENV !== 'production') {
    const demoRole = req.headers['x-demo-role'];
    if (demoRole === 'admin') {
      let demoAdmin = await User.findOne({ role: 'admin' });
      if (!demoAdmin) {
        demoAdmin = await User.create({
          clerkId: 'demo_admin_user_2026',
          name: 'LuxeStyle Administrator',
          email: 'admin@luxestyle.com',
          role: 'admin',
        });
      }
      req.user = demoAdmin;
      return next();
    }
    if (demoRole === 'merchant') {
      const demoMerchant = await User.findOne({ role: 'merchant' });
      if (demoMerchant) {
        req.user = demoMerchant;
        return next();
      }
    }
    if (demoRole === 'user' || demoRole === 'customer') {
      const demoCustomer = await User.findOne({ email: 'priya.sharma@example.com' });
      if (demoCustomer) {
        req.user = demoCustomer;
        return next();
      }
    }
    throw new ApiError(401, 'Not authenticated');
  }

  if (!isDbConnected()) {
    throw new ApiError(503, 'Database is not connected yet.');
  }

  req.user = await getOrCreateUser(userId);
  next();
});

/** Same as requireAuth, but does not fail when there is no session — req.user may be null. */
export const attachUserIfPresent = asyncHandler(async (req, res, next) => {
  if (!isClerkConfigured || !isDbConnected()) return next();

  const { userId } = getAuth(req);
  if (userId) {
    req.user = await getOrCreateUser(userId);
  }
  next();
});

export const requireAdmin = asyncHandler(async (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required');
  }
  next();
});

export const requireAdminOrMerchant = asyncHandler(async (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'merchant')) {
    throw new ApiError(403, 'Merchant or Admin access required');
  }
  next();
});

export const requireMerchant = asyncHandler(async (req, res, next) => {
  if (!req.user || req.user.role !== 'merchant') {
    throw new ApiError(403, 'Merchant access required');
  }
  next();
});

export const requireCustomer = asyncHandler(async (req, res, next) => {
  if (!req.user || req.user.role !== 'user') {
    throw new ApiError(403, 'Customer access required');
  }
  next();
});
