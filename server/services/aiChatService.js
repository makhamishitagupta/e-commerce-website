import Product from '../models/Product.js';
import BundleOffer from '../models/BundleOffer.js';

/**
 * Intelligent shopping assistant orchestration
 * Understands customer intent, executes catalog searches, suggests approved bundles,
 * and prepares cart / checkout action cards.
 */
export const processChatMessage = async ({ message, conversationHistory = [], cartItems = [] }) => {
  const query = (message || '').trim().toLowerCase();

  // 1. Checkout intent
  if (
    query.includes('checkout') ||
    query.includes('pay now') ||
    query.includes('buy now') ||
    query.includes('place order')
  ) {
    if (!cartItems || cartItems.length === 0) {
      return {
        message: "Your bag is currently empty. Would you like me to recommend some of our trending pieces or curated bundle offers first?",
        type: 'text',
        suggestions: ['Show trending items', 'View luxury bundles', 'Men’s clothing', 'Women’s dresses'],
      };
    }

    const subtotal = cartItems.reduce(
      (sum, item) => sum + (item.product?.discountPrice || item.product?.price || 0) * (item.quantity || 1),
      0
    );
    const shipping = subtotal >= 2000 ? 0 : 99;
    const total = subtotal + shipping;

    return {
      message: `I've prepared your checkout summary for ₹${total.toLocaleString()}. Please review your items and click 'Authorize & Pay' to complete your order securely via Razorpay TEST.`,
      type: 'checkout_action',
      checkoutData: {
        itemCount: cartItems.length,
        subtotal,
        shipping,
        total,
      },
      suggestions: ['Add more items', 'Change delivery details'],
    };
  }

  // 2. Bundles & Offers intent
  if (
    query.includes('bundle') ||
    query.includes('combo') ||
    query.includes('offer') ||
    query.includes('discount') ||
    query.includes('deal') ||
    query.includes('pair')
  ) {
    const bundles = await BundleOffer.find({ status: 'approved' })
      .populate({
        path: 'products.product',
        select: 'name price discountPrice images slug stock inStock',
      })
      .limit(4);

    if (bundles.length > 0) {
      return {
        message: `Here are our exclusive merchant-approved AI bundles! You can save up to ${bundles[0].discountPercentage}% when purchased together:`,
        type: 'bundle_offers',
        bundles,
        suggestions: ['Show men’s essentials', 'Show women’s dresses', 'Checkout my bag'],
      };
    }
  }

  // 3. Specific item addition to cart intent
  const addMatch = query.match(/(?:add|put)\s+(?:the\s+)?(.+?)(?:\s+to\s+(?:my\s+)?(?:cart|bag))/i);
  if (addMatch) {
    const targetName = addMatch[1].trim();
    const product = await Product.findOne({
      name: { $regex: targetName, $options: 'i' },
      isActive: true,
    }).select('name price discountPrice images slug stock');

    if (product) {
      return {
        message: `I've added the ${product.name} (₹${(product.discountPrice || product.price).toLocaleString()}) to your shopping bag!`,
        type: 'cart_action',
        action: {
          type: 'ADD_ITEM',
          product,
          quantity: 1,
        },
        suggestions: ['View my cart', 'Show matching accessories', 'Proceed to checkout'],
      };
    }
  }

  // 4. Catalog Search & Product Recommendations
  let searchFilter = { isActive: true };

  if (query.includes('men') && !query.includes('women')) {
    searchFilter.name = { $regex: 'shirt|tee|overcoat|oxford|men', $options: 'i' };
  } else if (query.includes('women') || query.includes('dress')) {
    searchFilter.name = { $regex: 'dress|blazer|sweater|women|tote', $options: 'i' };
  } else if (query.includes('shoe') || query.includes('sneaker') || query.includes('boot')) {
    searchFilter.name = { $regex: 'sneaker|boot|shoe|slip-on', $options: 'i' };
  } else if (query.includes('watch') || query.includes('belt') || query.includes('bag') || query.includes('accessori')) {
    searchFilter.name = { $regex: 'watch|belt|tote|bag', $options: 'i' };
  }

  // Price constraint extraction (e.g. "under 3000")
  const priceMatch = query.match(/under\s+(?:₹|rs\.?|inr\s*)?(\d+)/i);
  if (priceMatch) {
    const max = Number(priceMatch[1]);
    searchFilter.price = { $lte: max };
  }

  // If general greeting
  if (query === 'hi' || query === 'hello' || query === 'hey') {
    const featured = await Product.find({ isActive: true, featured: true }).limit(3);
    return {
      message: "Hello! Welcome to LuxeStyle. I'm your AI Shopping Concierge. I can help you discover luxury apparel, curated combos, check sizes, or guide you through seamless agentic checkout. What are you looking for today?",
      type: 'product_results',
      products: featured,
      suggestions: ['✨ Curated AI Bundles', '👔 Men’s Collection', '👗 Women’s Dresses', '👟 Footwear'],
    };
  }

  const products = await Product.find(searchFilter)
    .sort({ soldCount: -1, createdAt: -1 })
    .limit(4);

  if (products.length > 0) {
    return {
      message: `Here are the best pieces matching your style preferences:`,
      type: 'product_results',
      products,
      suggestions: ['Show bundle deals', 'Items under ₹3,000', 'Proceed to checkout'],
    };
  }

  // Fallback: show trending items
  const trending = await Product.find({ isActive: true }).sort({ soldCount: -1 }).limit(3);
  return {
    message: `I couldn't find an exact match for "${message}", but here are our most coveted best-sellers right now:`,
    type: 'product_results',
    products: trending,
    suggestions: ['Show all products', 'View AI bundles', 'Help me style an outfit'],
  };
};
