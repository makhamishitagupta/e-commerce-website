import 'dotenv/config';
import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Brand from '../models/Brand.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Merchant from '../models/Merchant.js';
import AgentApiKey from '../models/AgentApiKey.js';
import Order from '../models/Order.js';
import BundleOffer from '../models/BundleOffer.js';
import { slugify } from './slugify.js';
import { generateApiKey } from '../middleware/agentAuth.js';

const img = (seed, w = 800, h = 1000) => ({
  url: `https://picsum.photos/seed/${seed}/${w}/${h}`,
  publicId: seed,
});

const unsplash = (photoId) => ({
  url: `https://images.unsplash.com/photo-${photoId}?w=800&h=1000&fit=crop`,
  publicId: photoId,
});

const PRODUCT_PHOTOS = {
  'Classic Oxford Shirt': '1596755094514-f87e34085b2c',
  'Relaxed Fit Tee': '1521572163474-6864f9cf17ab',
  'Wool Blend Overcoat': '1591047139829-d91aecb6caea',
  'Silk Wrap Dress': '1595777457583-95e059d581b8',
  'Tailored Blazer': '1594938298603-c8148c4dae35',
  'Cashmere Knit Sweater': '1434389677669-e08b4cac3105',
  'Runner Sneakers': '1600185365483-26d7a4cc7519',
  'Leather Chelsea Boots': '1608256246200-53e635b5b65f',
  'Canvas Slip-Ons': '1595950653106-6c9ebd614d3a',
  'Structured Tote Bag': '1584917865442-de89df76afd3',
  'Minimalist Analog Watch': '1523275335684-37898b6baf30',
  'Full-Grain Leather Belt': '1624222247344-550fb60583dc',
};

const CATEGORIES = [
  { name: "Men's Clothing", description: 'Shirts, tees, jackets and more for men.' },
  { name: "Women's Clothing", description: 'Dresses, tops and outerwear for women.' },
  { name: 'Footwear', description: 'Sneakers, boots and sandals.' },
  { name: 'Accessories', description: 'Bags, belts, watches and more.' },
];

const BRANDS = [
  { name: 'Luxe Basics', description: 'Everyday essentials, elevated.' },
  { name: 'Aria Studio', description: 'Contemporary womenswear.' },
  { name: 'Northline', description: 'Performance footwear.' },
  { name: 'Velora', description: 'Premium accessories.' },
];

const PRODUCTS = [
  {
    name: 'Classic Oxford Shirt',
    category: "Men's Clothing",
    brand: 'Luxe Basics',
    price: 2499,
    discountPrice: 1999,
    stock: 40,
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['White', 'Sky Blue'],
    featured: true,
    trending: true,
    description: 'A tailored cotton oxford shirt built for both the office and evenings out.',
  },
  {
    name: 'Relaxed Fit Tee',
    category: "Men's Clothing",
    brand: 'Luxe Basics',
    price: 899,
    stock: 100,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: ['Black', 'Grey', 'Navy'],
    trending: true,
    description: 'Soft, breathable cotton tee with a relaxed everyday fit.',
  },
  {
    name: 'Wool Blend Overcoat',
    category: "Men's Clothing",
    brand: 'Northline',
    price: 7999,
    discountPrice: 6499,
    stock: 15,
    sizes: ['M', 'L', 'XL'],
    colors: ['Charcoal'],
    featured: true,
    description: 'A structured wool-blend overcoat for cold-weather layering.',
  },
  {
    name: 'Silk Wrap Dress',
    category: "Women's Clothing",
    brand: 'Aria Studio',
    price: 4599,
    stock: 25,
    sizes: ['XS', 'S', 'M', 'L'],
    colors: ['Emerald', 'Black'],
    featured: true,
    trending: true,
    description: 'A fluid silk wrap dress that transitions effortlessly from day to night.',
  },
  {
    name: 'Tailored Blazer',
    category: "Women's Clothing",
    brand: 'Aria Studio',
    price: 5299,
    discountPrice: 4299,
    stock: 20,
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    colors: ['Beige', 'Black'],
    description: 'A sharply tailored blazer that anchors any outfit.',
  },
  {
    name: 'Cashmere Knit Sweater',
    category: "Women's Clothing",
    brand: 'Luxe Basics',
    price: 3899,
    stock: 30,
    sizes: ['S', 'M', 'L'],
    colors: ['Cream', 'Rose'],
    trending: true,
    description: 'A cloud-soft cashmere sweater for everyday warmth and comfort.',
  },
  {
    name: 'Runner Sneakers',
    category: 'Footwear',
    brand: 'Northline',
    price: 4999,
    discountPrice: 3999,
    stock: 60,
    sizes: ['UK6', 'UK7', 'UK8', 'UK9', 'UK10'],
    colors: ['White', 'Black'],
    featured: true,
    trending: true,
    description: 'Lightweight everyday sneakers with responsive cushioning.',
  },
  {
    name: 'Leather Chelsea Boots',
    category: 'Footwear',
    brand: 'Northline',
    price: 6499,
    stock: 25,
    sizes: ['UK7', 'UK8', 'UK9', 'UK10'],
    colors: ['Tan', 'Black'],
    description: 'Handcrafted leather Chelsea boots for a polished finish.',
  },
  {
    name: 'Canvas Slip-Ons',
    category: 'Footwear',
    brand: 'Luxe Basics',
    price: 1799,
    stock: 50,
    sizes: ['UK6', 'UK7', 'UK8', 'UK9'],
    colors: ['Navy', 'Grey'],
    description: 'Easy slip-on canvas shoes for warm-weather days.',
  },
  {
    name: 'Structured Tote Bag',
    category: 'Accessories',
    brand: 'Velora',
    price: 3299,
    discountPrice: 2799,
    stock: 35,
    colors: ['Tan', 'Black'],
    featured: true,
    description: 'A structured leather tote with room for a laptop and daily essentials.',
  },
  {
    name: 'Minimalist Analog Watch',
    category: 'Accessories',
    brand: 'Velora',
    price: 5999,
    stock: 20,
    colors: ['Silver', 'Rose Gold'],
    trending: true,
    description: 'A clean-faced analog watch with a genuine leather strap.',
  },
  {
    name: 'Full-Grain Leather Belt',
    category: 'Accessories',
    brand: 'Velora',
    price: 1499,
    stock: 45,
    colors: ['Brown', 'Black'],
    description: 'A durable full-grain leather belt with a brushed steel buckle.',
  },
];

const run = async () => {
  if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('<username>')) {
    console.error('[seed] MONGODB_URI is not set in server/.env — aborting.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`[seed] Connected: ${mongoose.connection.host}`);

  // Clear existing collections for a clean seed
  await Promise.all([
    Category.deleteMany({}),
    Brand.deleteMany({}),
    Product.deleteMany({}),
    Merchant.deleteMany({}),
    AgentApiKey.deleteMany({}),
    BundleOffer.deleteMany({}),
    Order.deleteMany({}),
    User.deleteMany({ email: { $in: ['merchant@luxestyle.com', 'priya.sharma@example.com'] } }),
  ]);
  console.log('[seed] Cleared existing data.');

  // 1. Seed Categories & Brands
  const categoryDocs = await Category.insertMany(
    CATEGORIES.map((c) => ({ ...c, slug: slugify(c.name), image: img(`cat-${slugify(c.name)}`) }))
  );
  const categoryByName = Object.fromEntries(categoryDocs.map((c) => [c.name, c]));

  const brandDocs = await Brand.insertMany(
    BRANDS.map((b) => ({ ...b, slug: slugify(b.name), logo: img(`brand-${slugify(b.name)}`, 200, 200) }))
  );
  const brandByName = Object.fromEntries(brandDocs.map((b) => [b.name, b]));

  // 2. Seed Demo Merchant User & Store
  const merchantUser = await User.create({
    clerkId: 'user_demo_merchant_2026',
    name: 'Luxe Merchant Admin',
    email: 'merchant@luxestyle.com',
    phone: '+91 98765 43210',
    role: 'merchant',
  });

  const flagshipMerchant = await Merchant.create({
    owner: merchantUser._id,
    storeName: 'LuxeStyle Flagship Atelier',
    slug: 'luxestyle-flagship',
    description: 'Official flagship boutique presenting curated contemporary fashion and fine accessories.',
    contactEmail: 'flagship@luxestyle.com',
    contactPhone: '+91 98765 43210',
    businessCategory: 'Haute Couture & Accessories',
    status: 'active',
  });

  merchantUser.merchantId = flagshipMerchant._id;
  await merchantUser.save();

  // 3. Seed Products with Merchant Link
  const productDocs = PRODUCTS.map((p, i) => ({
    ...p,
    slug: slugify(p.name),
    sku: `LX-${String(i + 1).padStart(4, '0')}`,
    category: categoryByName[p.category]._id,
    brand: brandByName[p.brand]._id,
    merchant: flagshipMerchant._id,
    images: [unsplash(PRODUCT_PHOTOS[p.name])],
  }));
  const insertedProducts = await Product.insertMany(productDocs);
  const productByName = Object.fromEntries(insertedProducts.map((p) => [p.name, p]));

  // 4. Seed Seed-Key for External AI Agents
  const { rawKey, keyPrefix, keyHash } = generateApiKey();
  await AgentApiKey.create({
    merchant: flagshipMerchant._id,
    name: 'Primary AI Assistant Key',
    keyPrefix,
    keyHash,
    permissions: ['catalog:read', 'cart:write', 'checkout:write', 'analytics:read'],
    createdByUser: merchantUser._id,
  });

  // 5. Seed Demo Customers & Historical Orders for Rich Transaction Intelligence
  const customerUser = await User.create({
    clerkId: 'user_demo_customer_2026',
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    phone: '+91 99887 76655',
    role: 'user',
  });

  const sampleAddress = {
    fullName: 'Priya Sharma',
    phone: '+91 99887 76655',
    line1: 'Flat 402, Signature Towers, Indiranagar',
    line2: '100 Feet Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560038',
    country: 'India',
  };

  // Co-purchased Baskets:
  // Pair 1: Classic Oxford Shirt + Full-Grain Leather Belt (high lift)
  // Pair 2: Silk Wrap Dress + Structured Tote Bag (high lift)
  // Pair 3: Runner Sneakers + Relaxed Fit Tee (high lift)
  // Pair 4: Tailored Blazer + Minimalist Analog Watch
  const orderTemplates = [
    {
      items: ['Classic Oxford Shirt', 'Full-Grain Leather Belt'],
      repeat: 8,
      agentOrder: false,
    },
    {
      items: ['Silk Wrap Dress', 'Structured Tote Bag'],
      repeat: 7,
      agentOrder: true,
    },
    {
      items: ['Runner Sneakers', 'Relaxed Fit Tee'],
      repeat: 6,
      agentOrder: false,
    },
    {
      items: ['Tailored Blazer', 'Minimalist Analog Watch'],
      repeat: 5,
      agentOrder: true,
    },
    {
      items: ['Wool Blend Overcoat', 'Classic Oxford Shirt'],
      repeat: 3,
      agentOrder: false,
    },
  ];

  let totalOrdersSeeded = 0;
  let totalRevenueSeeded = 0;
  let agentRevenueSeeded = 0;
  let agentOrdersSeeded = 0;

  for (const template of orderTemplates) {
    for (let r = 0; r < template.repeat; r++) {
      const orderItems = template.items.map((name) => {
        const prod = productByName[name];
        return {
          product: prod._id,
          name: prod.name,
          image: prod.images?.[0]?.url,
          price: prod.discountPrice || prod.price,
          quantity: 1,
        };
      });

      const itemsPrice = orderItems.reduce((sum, i) => sum + i.price, 0);
      const shippingPrice = itemsPrice >= 2000 ? 0 : 99;
      const totalAmount = itemsPrice + shippingPrice;

      await Order.create({
        user: customerUser._id,
        items: orderItems,
        shippingAddress: sampleAddress,
        paymentMethod: 'razorpay',
        paymentStatus: 'paid',
        orderStatus: 'delivered',
        statusHistory: [{ status: 'delivered', changedAt: new Date(Date.now() - (r + 1) * 86400000) }],
        itemsPrice,
        shippingPrice,
        totalAmount,
        merchant: flagshipMerchant._id,
        isAgentOrder: template.agentOrder,
        agentOrigin: template.agentOrder ? 'external_agent' : 'direct_web',
        createdAt: new Date(Date.now() - (r + 1) * 86400000 * 2),
      });

      totalOrdersSeeded++;
      totalRevenueSeeded += totalAmount;
      if (template.agentOrder) {
        agentRevenueSeeded += totalAmount;
        agentOrdersSeeded++;
      }
    }
  }

  // 6. Seed Initial Approved & Suggested Bundles
  const oxford = productByName['Classic Oxford Shirt'];
  const belt = productByName['Full-Grain Leather Belt'];
  const dress = productByName['Silk Wrap Dress'];
  const tote = productByName['Structured Tote Bag'];

  await BundleOffer.create({
    merchant: flagshipMerchant._id,
    title: 'The Executive Sartorial Pairing',
    description: 'The Classic Oxford Shirt complemented with the handcrafted Full-Grain Leather Belt.',
    bundleType: 'combo',
    products: [
      { product: oxford._id, discountRate: 15 },
      { product: belt._id, discountRate: 15 },
    ],
    originalPrice: (oxford.discountPrice || oxford.price) + (belt.discountPrice || belt.price),
    bundlePrice: Math.round(((oxford.discountPrice || oxford.price) + (belt.discountPrice || belt.price)) * 0.85),
    discountPercentage: 15,
    metrics: { support: 0.28, confidence: 0.72, lift: 2.45, coPurchaseCount: 8 },
    aiRationale:
      'Statistical correlation reveals 72% co-purchase confidence between the Oxford Shirt and Leather Belt (Lift: 2.45x). Bundling at 15% discount drives basket size.',
    status: 'approved',
    approvedAt: new Date(),
  });

  await BundleOffer.create({
    merchant: flagshipMerchant._id,
    title: 'The Gala & Soirée Ensemble',
    description: 'Silk Wrap Dress paired with the Structured Tote Bag.',
    bundleType: 'bundle',
    products: [
      { product: dress._id, discountRate: 20 },
      { product: tote._id, discountRate: 20 },
    ],
    originalPrice: (dress.discountPrice || dress.price) + (tote.discountPrice || tote.price),
    bundlePrice: Math.round(((dress.discountPrice || dress.price) + (tote.discountPrice || tote.price)) * 0.8),
    discountPercentage: 20,
    metrics: { support: 0.24, confidence: 0.68, lift: 2.15, coPurchaseCount: 7 },
    aiRationale:
      'High propensity for luxury fashion pairing. Suggested for evening wear promotions with a 20% bundle discount.',
    status: 'suggested',
  });

  // 7. Update Merchant Metrics
  flagshipMerchant.metrics = {
    totalRevenue: totalRevenueSeeded,
    totalOrders: totalOrdersSeeded,
    agentRevenue: agentRevenueSeeded,
    agentOrders: agentOrdersSeeded,
  };
  await flagshipMerchant.save();

  console.log(`[seed] Inserted:`);
  console.log(`  - 1 Merchant: ${flagshipMerchant.storeName}`);
  console.log(`  - 1 Agent API Key: ${rawKey}`);
  console.log(`  - ${insertedProducts.length} Products`);
  console.log(`  - ${totalOrdersSeeded} Historical Orders (Revenue: ₹${totalRevenueSeeded.toLocaleString()}, Agent Revenue: ₹${agentRevenueSeeded.toLocaleString()})`);
  console.log(`  - 2 AI Bundle Offers (1 Approved, 1 Suggested)`);

  await mongoose.disconnect();
  console.log('[seed] Seeding complete.');
  process.exit(0);
};

run().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
