import 'dotenv/config';
import mongoose from 'mongoose';
import crypto from 'crypto';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Merchant from '../models/Merchant.js';
import Category from '../models/Category.js';
import Brand from '../models/Brand.js';
import { getRazorpayKeyId, getRazorpayKeySecret, isRazorpayConfigured } from '../config/razorpay.js';

const BASE_URL = 'http://127.0.0.1:5000/api';

const results = [];
function record(testName, passed, details = '') {
  results.push({ testName, passed, details });
  const mark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${mark}: ${testName}${details ? ` -> ${details}` : ''}`);
}

async function runAudit() {
  console.log('\n=============================================================');
  console.log('STARTING END-TO-END QA AUDIT & REGRESSION SUITE');
  console.log('=============================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[test] Connected to MongoDB');

  // --- 1. Product Catalog & Search Testing ---
  console.log('\n--- 1. Testing Product Catalog & Search ---');

  // 1a. General Catalog
  const catRes = await fetch(`${BASE_URL}/products?limit=12`).then((r) => r.json());
  record('Catalog loads products with pagination', catRes.data?.products?.length > 0, `Total: ${catRes.data?.pagination?.total}`);

  // 1b. Exact search
  const exactRes = await fetch(`${BASE_URL}/products?search=Classic%20Oxford%20Shirt`).then((r) => r.json());
  const foundExact = exactRes.data?.products?.some((p) => p.name === 'Classic Oxford Shirt');
  record('Exact product name search', foundExact, `Found: ${exactRes.data?.products?.length} items`);

  // 1c. Partial name search
  const partialRes = await fetch(`${BASE_URL}/products?search=oxford`).then((r) => r.json());
  const foundPartial = partialRes.data?.products?.some((p) => /oxford/i.test(p.name));
  record('Partial product name search ("oxford")', foundPartial, `Found: ${partialRes.data?.products?.length} items`);

  // 1d. Capitalization tolerance
  const capRes = await fetch(`${BASE_URL}/products?search=OXFORD%20SHIRT`).then((r) => r.json());
  const foundCap = capRes.data?.products?.some((p) => /oxford/i.test(p.name));
  record('Capitalization search tolerance ("OXFORD SHIRT")', foundCap);

  // 1e. Live Autocomplete Suggestions endpoint
  const suggRes = await fetch(`${BASE_URL}/products/search?q=dress`).then((r) => r.json());
  record('Live search suggestions API (/products/search?q=dress)', suggRes.data?.length > 0, `Suggestions: ${suggRes.data?.length}`);

  // 1f. No results search returns empty array gracefully
  const noRes = await fetch(`${BASE_URL}/products?search=nonexistentxyz9988`).then((r) => r.json());
  record('No-results search returns empty array gracefully', noRes.data?.products?.length === 0);

  // 1g. Special characters in search query
  const specRes = await fetch(`${BASE_URL}/products?search=shirt+%26+cotton`).then((r) => r.json());
  record('Search with special characters handled without crashing', Array.isArray(specRes.data?.products));

  // --- 2. User Isolation & Address Management ---
  console.log('\n--- 2. Testing User Data Isolation & Address CRUD ---');

  // Setup User A and User B
  await User.deleteMany({ email: { $in: ['test_user_a@luxestyle.test', 'test_user_b@luxestyle.test'] } });

  const userA = await User.create({
    clerkId: `clerk_test_a_${Date.now()}`,
    name: 'Customer Alice',
    email: 'test_user_a@luxestyle.test',
    phone: '+91 91234 56780',
    role: 'user',
  });

  const userB = await User.create({
    clerkId: `clerk_test_b_${Date.now()}`,
    name: 'Customer Bob',
    email: 'test_user_b@luxestyle.test',
    phone: '+91 99880 11223',
    role: 'user',
  });

  // Headers for User A and User B
  const headersA = { 'Content-Type': 'application/json', 'x-test-user-id': userA._id.toString() };
  const headersB = { 'Content-Type': 'application/json', 'x-test-user-id': userB._id.toString() };

  // Profile get
  const profileA = await fetch(`${BASE_URL}/users/me`, { headers: headersA }).then((r) => r.json());
  record('User A fetches own profile', profileA.data?.email === userA.email, `Profile email: ${profileA.data?.email}`);

  // Profile update
  const updatedA = await fetch(`${BASE_URL}/users/me`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({ name: 'Alice Walker', phone: '+91 98765 00001' }),
  }).then((r) => r.json());
  record('User A updates own profile details', updatedA.data?.name === 'Alice Walker');

  // Address 1: Add first address (should auto become default)
  const addr1Res = await fetch(`${BASE_URL}/users/me/addresses`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      fullName: 'Alice Walker',
      phone: '+91 98765 00001',
      line1: '123 Fashion Blvd',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      country: 'India',
    }),
  }).then((r) => r.json());
  const addr1Id = addr1Res.data?.addresses?.[0]?._id;
  record('User A adds address (auto-defaulted)', addr1Res.data?.addresses?.[0]?.isDefault === true);

  // Address 2: Add second address with isDefault: true (should become default and make address 1 non-default)
  const addr2Res = await fetch(`${BASE_URL}/users/me/addresses`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      fullName: 'Alice Walker (Office)',
      phone: '+91 98765 00002',
      line1: '456 Tech Park',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400051',
      country: 'India',
      isDefault: true,
    }),
  }).then((r) => r.json());
  const addr2 = addr2Res.data?.addresses?.find((a) => a.line1 === '456 Tech Park');
  const addr1Updated = addr2Res.data?.addresses?.find((a) => a._id === addr1Id);
  record('User A adds second address as default -> address 1 becomes non-default', addr2?.isDefault === true && addr1Updated?.isDefault === false);

  // Address update
  const editAddrRes = await fetch(`${BASE_URL}/users/me/addresses/${addr1Id}`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({ line2: 'Floor 5, Suite B' }),
  }).then((r) => r.json());
  const editedAddr1 = editAddrRes.data?.addresses?.find((a) => a._id === addr1Id);
  record('User A edits address line2', editedAddr1?.line2 === 'Floor 5, Suite B');

  // Data isolation: User B must have 0 addresses
  const profileB = await fetch(`${BASE_URL}/users/me`, { headers: headersB }).then((r) => r.json());
  record('Data Isolation: User B has 0 addresses and cannot see User A addresses', profileB.data?.addresses?.length === 0);

  // --- 3. Cart Lifecycle & Stock Bounds ---
  console.log('\n--- 3. Testing Cart Lifecycle & Quantity Bounds ---');

  const products = await Product.find({ isActive: true, stock: { $gte: 5 } }).limit(2);
  const prod1 = products[0];

  // 3a. Add to cart
  const addCartRes = await fetch(`${BASE_URL}/cart`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ productId: prod1._id.toString(), quantity: 2 }),
  }).then((r) => r.json());
  record('Add item to cart with quantity 2', addCartRes.data?.length === 1 && addCartRes.data[0].quantity === 2);

  const cartItemId = addCartRes.data?.[0]?._id;

  // 3b. Update quantity
  const updateQtyRes = await fetch(`${BASE_URL}/cart/${cartItemId}`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({ quantity: 3 }),
  }).then((r) => r.json());
  record('Update cart quantity to 3', updateQtyRes.data?.[0]?.quantity === 3);

  // 3c. Over-stock check: requesting 999999 must fail with 400
  const overStockRes = await fetch(`${BASE_URL}/cart/${cartItemId}`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({ quantity: 999999 }),
  });
  record('Cart rejects quantity exceeding product available stock', overStockRes.status === 400);

  // 3d. User B cart is empty
  const cartBRes = await fetch(`${BASE_URL}/cart`, { headers: headersB }).then((r) => r.json());
  record('Data Isolation: User B cart is empty (isolated from User A)', cartBRes.data?.length === 0);

  // 3e. Atomic clear cart
  const clearRes = await fetch(`${BASE_URL}/cart`, { method: 'DELETE', headers: headersA }).then((r) => r.json());
  record('Atomic clear cart (DELETE /api/cart) empties user cart', clearRes.data?.length === 0);

  // --- 4. Real Order Creation (Cash on Delivery) & Calculations ---
  console.log('\n--- 4. Testing Order Creation & Pricing Calculations ---');

  // Repopulate cart for order
  await fetch(`${BASE_URL}/cart`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ productId: prod1._id.toString(), quantity: 1 }),
  });

  const activeAddress = {
    fullName: 'Alice Walker',
    phone: '+91 98765 00001',
    line1: '123 Fashion Blvd',
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400001',
    country: 'India',
  };

  const unitPrice = prod1.discountPrice || prod1.price;
  const initialStock = prod1.stock;

  const orderRes = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      items: [{ productId: prod1._id.toString(), quantity: 1 }],
      shippingAddress: activeAddress,
    }),
  }).then((r) => r.json());

  const createdOrder = orderRes.data;
  record('Order created successfully via COD', Boolean(createdOrder?._id));

  // Verify Calculations
  const expectedShipping = unitPrice >= 2000 ? 0 : 99;
  const expectedTotal = unitPrice + expectedShipping;
  const calcsMatch =
    createdOrder?.itemsPrice === unitPrice &&
    createdOrder?.shippingPrice === expectedShipping &&
    createdOrder?.totalAmount === expectedTotal;
  record('Order pricing matches: itemsPrice + shippingPrice = totalAmount', calcsMatch, `Total: ₹${createdOrder?.totalAmount}`);

  // Verify stock decremented
  const updatedProd1 = await Product.findById(prod1._id);
  record('Inventory decremented by ordered quantity in database', updatedProd1.stock === initialStock - 1);

  // Verify Order History for User A
  const myOrdersRes = await fetch(`${BASE_URL}/orders`, { headers: headersA }).then((r) => r.json());
  const foundOrderInHistory = myOrdersRes.data?.some((o) => o._id === createdOrder._id);
  record('Order appears in User A order history (/api/orders)', foundOrderInHistory);

  // Data Isolation: User B cannot view User A's order by ID
  const userBOrderAccess = await fetch(`${BASE_URL}/orders/${createdOrder._id}`, { headers: headersB });
  record('Data Isolation: User B receives 403 Forbidden accessing User A order by ID', userBOrderAccess.status === 403);

  // --- 5. Razorpay TEST Payment Gateway Integration & Cryptographic HMAC Verification ---
  console.log('\n--- 5. Testing Razorpay Payment Gateway & HMAC Verification ---');

  record('Razorpay API keys configured in environment', isRazorpayConfigured(), `Key ID: ${getRazorpayKeyId()}`);

  const rzpOrderRes = await fetch(`${BASE_URL}/payment/create-order`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      items: [{ productId: prod1._id.toString(), quantity: 1 }],
      shippingAddress: activeAddress,
    }),
  }).then((r) => r.json());

  const rzpOrderId = rzpOrderRes.data?.orderId;
  const isRealRzpOrder = typeof rzpOrderId === 'string' && rzpOrderId.startsWith('order_');
  record('Real Razorpay test order created via Razorpay API (starts with order_)', isRealRzpOrder, `Razorpay Order ID: ${rzpOrderId}`);

  // Test 5b: Invalid Signature verification MUST be rejected
  const fakeVerifyRes = await fetch(`${BASE_URL}/payment/verify`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: 'pay_test_tampered_123',
      razorpay_signature: 'invalid_tampered_signature_hex',
      items: [{ productId: prod1._id.toString(), quantity: 1 }],
      shippingAddress: activeAddress,
    }),
  });
  record('Backend rejects forged/invalid Razorpay signature (400 Bad Request)', fakeVerifyRes.status === 400);

  // Test 5c: Cryptographically authentic HMAC SHA-256 signature verification
  const testPaymentId = `pay_rzp_test_${Date.now()}`;
  const validSignature = crypto
    .createHmac('sha256', getRazorpayKeySecret())
    .update(`${rzpOrderId}|${testPaymentId}`)
    .digest('hex');

  const validVerifyRes = await fetch(`${BASE_URL}/payment/verify`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: testPaymentId,
      razorpay_signature: validSignature,
      items: [{ productId: prod1._id.toString(), quantity: 1 }],
      shippingAddress: activeAddress,
    }),
  }).then((r) => r.json());

  const paidOrder = validVerifyRes.data;
  const verifiedCorrectly =
    paidOrder?.paymentStatus === 'paid' &&
    paidOrder?.orderStatus === 'processing' &&
    paidOrder?.razorpayOrderId === rzpOrderId;
  record('Cryptographically verified Razorpay payment creates paid order with processing status', verifiedCorrectly, `Order ID: ${paidOrder?._id}`);

  // Duplicate payment verification idempotency check
  const duplicateVerifyRes = await fetch(`${BASE_URL}/payment/verify`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: testPaymentId,
      razorpay_signature: validSignature,
      items: [{ productId: prod1._id.toString(), quantity: 1 }],
      shippingAddress: activeAddress,
    }),
  }).then((r) => r.json());
  record('Idempotent handling: duplicate verification does not create duplicate order', duplicateVerifyRes.data?._id === paidOrder?._id);

  // Clean up test users and orders
  await Order.deleteMany({ user: { $in: [userA._id, userB._id] } });
  await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });

  await mongoose.disconnect();
  console.log('\n=============================================================');
  console.log(`TEST SUMMARY: ${results.filter((r) => r.passed).length}/${results.length} tests PASSED`);
  console.log('=============================================================\n');

  if (results.some((r) => !r.passed)) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error('[test] Fatal error in audit:', err);
  process.exit(1);
});
