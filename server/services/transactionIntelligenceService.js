import Order from '../models/Order.js';
import Product from '../models/Product.js';
import BundleOffer from '../models/BundleOffer.js';

/**
 * High-performing statistical Market Basket Analysis algorithm
 * Computes Support, Confidence, Lift, and Co-occurrence frequencies directly on MongoDB transactions.
 */
export const analyzeTransactions = async (merchantId) => {
  const query = merchantId ? { merchant: merchantId } : {};
  const orders = await Order.find(query).select('items totalAmount createdAt paymentStatus');

  const totalOrders = orders.length;
  if (totalOrders === 0) {
    // If no orders yet, return empty analysis
    return {
      totalOrders: 0,
      correlationPairs: [],
      suggestions: [],
    };
  }

  // 1. Build Baskets
  const baskets = [];
  const itemCounts = {};

  orders.forEach((order) => {
    const itemIds = [
      ...new Set(
        (order.items || [])
          .map((i) => i.product?.toString())
          .filter(Boolean)
      ),
    ];

    if (itemIds.length > 0) {
      baskets.push(itemIds);
      itemIds.forEach((id) => {
        itemCounts[id] = (itemCounts[id] || 0) + 1;
      });
    }
  });

  const N = Math.max(1, baskets.length);

  // 2. Count Pair Co-occurrences
  const pairCounts = {};

  baskets.forEach((basket) => {
    for (let i = 0; i < basket.length; i++) {
      for (let j = i + 1; j < basket.length; j++) {
        const id1 = basket[i];
        const id2 = basket[j];
        const key = id1 < id2 ? `${id1}__${id2}` : `${id2}__${id1}`;
        pairCounts[key] = (pairCounts[key] || 0) + 1;
      }
    }
  });

  // 3. Compute Metrics for each pair
  const productIds = Object.keys(itemCounts);
  const products = await Product.find({ _id: { $in: productIds }, merchant: merchantId })
    .select('name price discountPrice category images stock')
    .populate('category', 'name');

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const correlationPairs = [];

  for (const [pairKey, count] of Object.entries(pairCounts)) {
    const [idA, idB] = pairKey.split('__');
    const prodA = productMap.get(idA);
    const prodB = productMap.get(idB);

    if (!prodA || !prodB) continue;

    const countA = itemCounts[idA] || 1;
    const countB = itemCounts[idB] || 1;

    const support = count / N;
    const confidenceAtoB = count / countA;
    const confidenceBtoA = count / countB;
    const lift = (count * N) / (countA * countB);

    correlationPairs.push({
      productA: prodA,
      productB: prodB,
      coPurchaseCount: count,
      support: Number(support.toFixed(3)),
      confidenceAtoB: Number(confidenceAtoB.toFixed(3)),
      confidenceBtoA: Number(confidenceBtoA.toFixed(3)),
      lift: Number(lift.toFixed(2)),
    });
  }

  // Sort by lift descending, then co-purchase count
  correlationPairs.sort((a, b) => b.lift - a.lift || b.coPurchaseCount - a.coPurchaseCount);

  // 4. Generate AI Bundle Suggestions for top pairs
  const suggestions = [];
  const candidatePairs = correlationPairs.slice(0, 6);

  for (const pair of candidatePairs) {
    const p1 = pair.productA;
    const p2 = pair.productB;

    // Check if an active or suggested bundle already exists with these products
    const existing = await BundleOffer.findOne({
      merchant: merchantId,
      'products.product': { $all: [p1._id, p2._id] },
    });

    if (existing) {
      suggestions.push(existing);
      continue;
    }

    const price1 = p1.discountPrice || p1.price;
    const price2 = p2.discountPrice || p2.price;
    const originalPrice = price1 + price2;

    // Smart bundle discount: 15% to 20%
    const discountPercentage = 15;
    const bundlePrice = Math.round(originalPrice * (1 - discountPercentage / 100));

    // Determine creative title based on product categories/names
    const title = generateBundleTitle(p1, p2);
    const rationale = `Customers who bought ${p1.name} were ${Math.round(
      pair.confidenceAtoB * 100
    )}% more likely to also purchase ${p2.name} (Lift: ${pair.lift}x). Bundling them at a ${discountPercentage}% savings creates an irresistible high-margin combo.`;

    const newBundle = await BundleOffer.create({
      merchant: merchantId,
      title,
      description: `Complete your look with the ${p1.name} paired with the ${p2.name}. Save ${discountPercentage}% when purchased as a set.`,
      bundleType: 'combo',
      products: [
        { product: p1._id, discountRate: discountPercentage },
        { product: p2._id, discountRate: discountPercentage },
      ],
      originalPrice,
      bundlePrice,
      discountPercentage,
      metrics: {
        support: pair.support,
        confidence: Math.max(pair.confidenceAtoB, pair.confidenceBtoA),
        lift: pair.lift,
        coPurchaseCount: pair.coPurchaseCount,
      },
      aiRationale: rationale,
      status: 'suggested',
    });

    suggestions.push(newBundle);
  }

  return {
    totalOrders,
    totalBaskets: N,
    correlationPairs: correlationPairs.slice(0, 10),
    suggestions,
  };
};

function generateBundleTitle(p1, p2) {
  const names = `${p1.name} & ${p2.name}`.toLowerCase();
  if (names.includes('shirt') && names.includes('belt')) {
    return 'The Executive Sartorial Pairing';
  }
  if (names.includes('dress') && names.includes('bag')) {
    return 'The Gala & Soirée Ensemble';
  }
  if (names.includes('sneaker') && names.includes('tee')) {
    return 'The Urban Everyday Essentials';
  }
  if (names.includes('blazer') && names.includes('watch')) {
    return 'The Signature Professional Duo';
  }
  if (names.includes('sweater') || names.includes('overcoat')) {
    return 'The Cashmere & Wool Layering Edit';
  }
  return `${p1.name} + ${p2.name} Deluxe Bundle`;
}
