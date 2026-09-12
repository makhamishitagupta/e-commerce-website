import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const addressFields = ['label', 'fullName', 'phone', 'line1', 'line2', 'city', 'state', 'postalCode', 'country', 'isDefault'];

const pickAddress = (address = {}) =>
  Object.fromEntries(addressFields.filter((field) => address[field] !== undefined).map((field) => [field, address[field]]));

export const getMe = (req, res) => {
  res.json(new ApiResponse(200, req.user));
};

export const updateMe = asyncHandler(async (req, res) => {
  const { name, phone, avatar } = req.body;
  if (name !== undefined) {
    if (!String(name).trim()) throw new ApiError(400, 'Name cannot be empty');
    req.user.name = String(name).trim();
  }
  if (phone !== undefined) req.user.phone = phone;
  if (avatar !== undefined) req.user.avatar = avatar;

  await req.user.save();
  res.json(new ApiResponse(200, req.user, 'Profile updated'));
});

export const addAddress = asyncHandler(async (req, res) => {
  const address = pickAddress(req.body);
  const requiredFields = ['fullName', 'phone', 'line1', 'city', 'state', 'postalCode'];
  if (requiredFields.some((field) => !String(address[field] || '').trim())) {
    throw new ApiError(400, 'fullName, phone, line1, city, state, and postalCode are required');
  }

  address.country = address.country || 'India';
  const shouldBeDefault = Boolean(address.isDefault || req.user.addresses.length === 0);
  if (shouldBeDefault) {
    req.user.addresses.forEach((existing) => { existing.isDefault = false; });
    address.isDefault = true;
  } else {
    address.isDefault = false;
  }

  req.user.addresses.push(address);
  await req.user.save();
  res.status(201).json(new ApiResponse(201, req.user, 'Address added'));
});

export const updateAddress = asyncHandler(async (req, res) => {
  const address = req.user.addresses.id(req.params.addressId);
  if (!address) throw new ApiError(404, 'Address not found');

  const update = pickAddress(req.body);
  Object.assign(address, update);
  if (req.body.isDefault !== undefined) {
    const makeDefault = Boolean(req.body.isDefault);
    if (makeDefault) {
      req.user.addresses.forEach((existing) => {
        existing.isDefault = existing._id.equals(address._id);
      });
    } else {
      address.isDefault = false;
      // If none is default, fallback to first
      if (!req.user.addresses.some((a) => a.isDefault) && req.user.addresses.length > 0) {
        req.user.addresses[0].isDefault = true;
      }
    }
  }
  await req.user.save();
  res.json(new ApiResponse(200, req.user, 'Address updated'));
});

export const deleteAddress = asyncHandler(async (req, res) => {
  const address = req.user.addresses.id(req.params.addressId);
  if (!address) throw new ApiError(404, 'Address not found');

  const wasDefault = address.isDefault;
  req.user.addresses.pull(address._id);
  if (wasDefault && req.user.addresses.length > 0) req.user.addresses[0].isDefault = true;
  await req.user.save();
  res.json(new ApiResponse(200, req.user, 'Address deleted'));
});