import Product from '../models/Product.js';
import BundleOffer from '../models/BundleOffer.js';
import {
  extractShoppingIntent,
  searchCatalog,
  normalizeText,
} from './aiShoppingEngine.js';

/**
 * Intelligent shopping assistant orchestration
 * Understands customer intent, executes catalog searches with strict relevance,
 * suggests approved bundles, and prepares cart / checkout action cards.
 */
export const processChatMessage = async ({
  message,
  conversationHistory = [],
  cartItems = [],
  merchantId = null,
}) => {
  const query = (message || '').trim();
  const normalized = normalizeText(query);

  // 1. Extract previous shopping context from history if available
  let previousContext = null;
  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const entry = conversationHistory[i];
      if (entry.context && typeof entry.context === 'object') {
        previousContext = entry.context;
        break;
      }
    }
  }

  // 2. Extract NLP intent
  const intent = extractShoppingIntent(query, previousContext);

  // 3. Handle Greetings
  if (intent.isGreeting) {
    const featured = await Product.find({ isActive: true, featured: true })
      .limit(3)
      .select('name price discountPrice images slug');

    return {
      message: "Hello! Welcome to LuxeStyle. I'm your AI Shopping Concierge. I can help you discover luxury apparel, curated combos, check sizes, or guide you through seamless agentic checkout. What are you looking for today?",
      type: 'products',
      products: featured,
      context: null,
      suggestions: [
        "Men's Oxford Shirts",
        "Women's Silk Dresses",
        'Designer Footwear',
        'Curated Bundles',
      ],
    };
  }

  // 4. Handle Checkout intent
  if (intent.isCheckoutAction) {
    if (!cartItems || cartItems.length === 0) {
      return {
        message: "Your bag is currently empty. Would you like me to recommend some of our trending pieces or curated bundle offers first?",
        type: 'text',
        context: null,
        suggestions: [
          'Show trending items',
          'View luxury bundles',
          "Men's clothing",
          "Women's dresses",
        ],
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
      context: null,
      suggestions: ['Add more items', 'Change delivery details'],
    };
  }

  // 5. Handle Bundles & Offers intent
  if (
    normalized.includes('bundle') ||
    normalized.includes('combo') ||
    normalized.includes('offer') ||
    normalized.includes('discount') ||
    normalized.includes('deal') ||
    normalized.includes('pair')
  ) {
    const bundleQuery = { status: 'approved' };
    if (merchantId) bundleQuery.merchant = merchantId;

    const bundles = await BundleOffer.find(bundleQuery)
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
        context: null,
        suggestions: ["Show men's essentials", "Show women's dresses", 'Checkout my bag'],
      };
    }
  }

  // 6. Handle Specific item addition to cart intent
  if (intent.isCartAction && intent.cartTarget) {
    const pQuery = {
      name: { $regex: intent.cartTarget, $options: 'i' },
      isActive: true,
    };
    if (merchantId) pQuery.merchant = merchantId;

    const product = await Product.findOne(pQuery).select('name price discountPrice images slug stock');

    if (product) {
      return {
        message: `I've added the ${product.name} (₹${(product.discountPrice || product.price).toLocaleString()}) to your shopping bag!`,
        type: 'cart_action',
        action: {
          type: 'ADD_ITEM',
          product,
          quantity: 1,
        },
        context: null,
        suggestions: ['View my cart', 'Show matching accessories', 'Proceed to checkout'],
      };
    } else {
      return {
        message: `I couldn't find "${intent.cartTarget}" to add to your bag. Would you like to browse our current luxury collection?`,
        type: 'text',
        context: null,
        suggestions: ["Show men's collection", "Show women's collection", 'Footwear', 'Accessories'],
      };
    }
  }

  // 7. Handle Out-Of-Catalog Queries (e.g., Ice Cream, Pizza, Laptops, Medicine, Furniture)
  if (intent.isOutOfCatalog) {
    const domainLabel = intent.outOfCatalogDomain || 'items outside fashion and accessories';
    return {
      message: `LuxeStyle is an exclusive luxury fashion & lifestyle boutique specializing in designer apparel, footwear, and accessories. We do not carry ${domainLabel} such as "${query}". Would you like to explore our latest fashion collections instead?`,
      type: 'text',
      products: [],
      context: intent,
      suggestions: [
        "Men's Collection",
        "Women's Collection",
        'Designer Footwear',
        'Luxury Accessories',
      ],
    };
  }

  // 8. Catalog Search using extracted intent & filters
  const searchResult = await searchCatalog(intent, { merchantId, limit: 6 });

  if (searchResult.products.length > 0) {
    let responseText = "Here are the pieces that match your request:";
    if (intent.categoryHint && intent.colors.length > 0) {
      responseText = `Here are our ${intent.colors.join('/')} selections in ${intent.categoryHint}:`;
    } else if (intent.categoryHint) {
      responseText = `Here are our top selections from ${intent.categoryHint}:`;
    } else if (intent.colors.length > 0) {
      responseText = `Here are our ${intent.colors.join('/')} luxury pieces:`;
    } else if (intent.maxPrice) {
      responseText = `Here are our selections under ₹${intent.maxPrice.toLocaleString()}:`;
    }

    const suggestions = [];
    if (!intent.maxPrice) suggestions.push('Under ₹3,000');
    if (intent.colors.length === 0) suggestions.push('In Black or White');
    if (!intent.sizes.length) suggestions.push('Size M or L');
    suggestions.push('Checkout my bag');

    return {
      message: responseText,
      type: 'products',
      products: searchResult.products,
      context: intent,
      suggestions: suggestions.slice(0, 4),
    };
  }

  // 9. When no products match the specific search
  return {
    message: `I couldn't find any products in our catalog matching "${query}". Would you like to browse our popular categories or filter by price?`,
    type: 'text',
    products: [],
    context: intent,
    suggestions: [
      "Men's Oxford Shirts",
      "Women's Silk Dresses",
      'Designer Footwear',
      'Luxury Accessories',
    ],
  };
};
