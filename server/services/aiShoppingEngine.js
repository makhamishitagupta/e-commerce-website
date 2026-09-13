import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Brand from '../models/Brand.js';

// Domain stop words and container terms that should NOT be required in product titles
const CONTAINER_WORDS = new Set([
  'collection', 'collections', 'clothing', 'clothes', 'wear', 'item', 'items',
  'product', 'products', 'stuff', 'range', 'section', 'line', 'apparel',
  'fashion', 'pieces', 'piece', 'category', 'shop', 'store'
]);

// Non-catalog domain indicators (food, grocery, electronics, medicine, heavy furniture)
const OUT_OF_CATALOG_DOMAINS = [
  {
    type: 'food_beverage',
    regex: /\b(ice\s*cream|gelato|sorbet|pizza|burger|sandwich|coffee|tea|beverage|snack|chocolate|dessert|cake|cookie|pastry|candy|food|grocery|groceries|fruit|vegetable|milk|cheese|bread|noodle|pasta|soda|juice|meal|lunch|dinner|breakfast)\b/i,
    label: 'food and culinary items',
  },
  {
    type: 'electronics',
    regex: /\b(laptop|macbook|computer|smartphone|iphone|android|mobile\s*phone|tv|television|camera|playstation|xbox|gpu|cpu|monitor|tablet|ipad)\b/i,
    label: 'electronics and computer hardware',
  },
  {
    type: 'medical',
    regex: /\b(medicine|tablet|syrup|prescription|pharma|bandage|vaccine)\b/i,
    label: 'medical and pharmaceutical products',
  },
  {
    type: 'furniture',
    regex: /\b(dining\s*table|sofa|couch|mattress|bed frame|wardrobe|bookshelf|desk)\b/i,
    label: 'home furniture',
  }
];

// Color dictionary with variations
const COLOR_MAP = {
  white: ['white', 'ivory', 'cream', 'off-white'],
  black: ['black', 'onyx', 'noir'],
  blue: ['blue', 'sky blue', 'navy', 'indigo', 'cyan', 'azure', 'denim'],
  navy: ['navy', 'dark blue'],
  grey: ['grey', 'gray', 'charcoal', 'ash', 'silver', 'slate'],
  gray: ['grey', 'gray', 'charcoal'],
  charcoal: ['charcoal', 'dark grey'],
  red: ['red', 'crimson', 'scarlet', 'ruby', 'burgundy', 'maroon'],
  emerald: ['emerald', 'green', 'olive', 'mint', 'sage'],
  green: ['green', 'emerald', 'olive', 'mint', 'sage'],
  gold: ['gold', 'golden', 'brass'],
  silver: ['silver', 'metallic'],
  brown: ['brown', 'tan', 'leather', 'cognac', 'camel', 'beige', 'khaki'],
  tan: ['tan', 'camel', 'beige', 'khaki'],
  beige: ['beige', 'cream', 'khaki', 'sand'],
};

// Size dictionary
const SIZE_SET = new Set(['xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', '32', '34', '36', '38', '40', '42', '44']);

/**
 * Normalizes query string and removes noisy punctuation
 */
export const normalizeText = (text = '') => {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Detects if the user query is asking for something completely outside LuxeStyle's domain
 */
export const detectOutOfCatalogDomain = (query = '') => {
  for (const domain of OUT_OF_CATALOG_DOMAINS) {
    if (domain.regex.test(query)) {
      return domain;
    }
  }
  return null;
};

/**
 * Extracts intent, slots, and filters from natural language queries
 */
export const extractShoppingIntent = (rawMessage = '', previousContext = null) => {
  const norm = normalizeText(rawMessage);
  const outDomain = detectOutOfCatalogDomain(norm);

  // Check if this turn is an explicit topic shift
  const isTopicShift = /\b(actually|instead|wait|nevermind|forget that|switch to|show me instead)\b/i.test(norm) ||
    (/\b(show|find|search|looking for|want|need)\s+(watches?|shoes?|boots?|sneakers?|shirts?|dresses?|coats?|belts?|bags?)/i.test(norm));

  const intent = {
    rawMessage,
    normalized: norm,
    isOutOfCatalog: Boolean(outDomain),
    outOfCatalogDomain: outDomain ? outDomain.label : null,
    targetItem: null,
    gender: null,          // 'men' | 'women' | 'unisex'
    categoryHint: null,    // e.g. "Men's Clothing", "Footwear"
    brandHint: null,
    colors: [],
    sizes: [],
    minPrice: null,
    maxPrice: null,
    sorting: null,         // 'price_asc' | 'price_desc' | 'popular' | 'newest'
    isGift: false,
    isCartAction: false,
    cartTarget: null,
    isCheckoutAction: false,
    isGreeting: false,
    isHelp: false,
  };

  // 1. Check conversational intents
  if (/^(hi|hello|hey|greetings|hola|good\s*(morning|afternoon|evening))\b/i.test(norm) && norm.split(' ').length <= 3) {
    intent.isGreeting = true;
  }

  if (/\b(checkout|pay now|buy now|place order|finalize order)\b/i.test(norm)) {
    intent.isCheckoutAction = true;
    return intent;
  }

  const addMatch = norm.match(/(?:add|put)\s+(?:the\s+)?(.+?)(?:\s+to\s+(?:my\s+)?(?:cart|bag))/i);
  if (addMatch) {
    intent.isCartAction = true;
    intent.cartTarget = addMatch[1].trim();
  }

  // 2. Gender / Audience detection with strict word boundaries
  // Note: "women" contains "men", so check women first or use boundary
  if (/\bwomen['s]*\b|\bfemale\b|\blady\b|\bladies\b|\bgirl['s]*\b/i.test(norm)) {
    intent.gender = 'women';
    intent.categoryHint = "Women's Clothing";
  } else if (/\bmen['s]*\b|\bmale\b|\bguy['s]*\b|\bboys?['s]*\b/i.test(norm)) {
    intent.gender = 'men';
    intent.categoryHint = "Men's Clothing";
  }

  // 3. Category hints
  if (/\b(shoes?|sneakers?|boots?|slip-ons?|footwear|loafers?)\b/i.test(norm)) {
    intent.categoryHint = 'Footwear';
    intent.targetItem = intent.targetItem || 'footwear';
  } else if (/\b(bags?|totes?|wallets?|belts?|watches?|accessories|accessory|sunglasses)\b/i.test(norm)) {
    intent.categoryHint = 'Accessories';
    intent.targetItem = intent.targetItem || 'accessories';
  } else if (/\b(dresses?|gowns?|skirts?|blouses?|sarees?)\b/i.test(norm)) {
    intent.categoryHint = "Women's Clothing";
    intent.gender = 'women';
    intent.targetItem = intent.targetItem || 'dress';
  } else if (/\b(shirts?|oxford|t-?shirts?|tees?|overcoats?|jackets?|blazers?|hoodies?|suits?|trousers?|pants?)\b/i.test(norm)) {
    if (!intent.gender) {
      // Default to Men's if generic shirt/tee in LuxeStyle catalog, or keep open
    }
    intent.targetItem = intent.targetItem || 'apparel';
  }

  // 4. Price extraction
  const underMatch = norm.match(/\b(?:under|below|less than|within|up to|max(?:imum)?)\s+(?:₹|rs\.?|inr\s*)?(\d+)/i);
  if (underMatch) {
    intent.maxPrice = Number(underMatch[1]);
  }

  const aboveMatch = norm.match(/\b(?:above|over|more than|at least|min(?:imum)?)\s+(?:₹|rs\.?|inr\s*)?(\d+)/i);
  if (aboveMatch) {
    intent.minPrice = Number(aboveMatch[1]);
  }

  const betweenMatch = norm.match(/\b(?:between|from)\s+(?:₹|rs\.?|inr\s*)?(\d+)\s+(?:to|and|-)\s+(?:₹|rs\.?|inr\s*)?(\d+)/i);
  if (betweenMatch) {
    intent.minPrice = Number(betweenMatch[1]);
    intent.maxPrice = Number(betweenMatch[2]);
  }

  // 5. Color extraction
  for (const [key, variants] of Object.entries(COLOR_MAP)) {
    for (const variant of variants) {
      const colorRegex = new RegExp(`\\b${variant}\\b`, 'i');
      if (colorRegex.test(norm)) {
        if (!intent.colors.includes(key)) {
          intent.colors.push(key);
        }
        break;
      }
    }
  }

  // 6. Size extraction
  const sizeMatch = norm.match(/\b(?:size\s+)?(xs|xxl|xxxl|s|m|l|xl|32|34|36|38|40|42|44)\b/i);
  if (sizeMatch && !['a', 'in'].includes(sizeMatch[1].toLowerCase())) {
    // avoid false positive if 's' matches 's' standalone
    const val = sizeMatch[1].toUpperCase();
    if (SIZE_SET.has(val.toLowerCase())) {
      intent.sizes.push(val);
    }
  }

  // 7. Extract specific product tokens (ignoring stop words & container words)
  const tokens = norm
    .split(' ')
    .filter(t => t.length > 2)
    .filter(t => !['the', 'for', 'and', 'with', 'need', 'want', 'show', 'give', 'looking', 'some', 'please', 'have', 'you', 'can', 'find'].includes(t))
    .filter(t => !CONTAINER_WORDS.has(t))
    .filter(t => !['men', 'mens', "men's", 'women', 'womens', "women's"].includes(t));

  if (tokens.length > 0 && !intent.targetItem) {
    intent.targetItem = tokens.join(' ');
  }

  // 8. Carry over progressive multi-turn context if user is refining
  if (previousContext && !isTopicShift && !intent.isOutOfCatalog) {
    // If previous was out of catalog, check if user is still in out of catalog domain
    if (previousContext.isOutOfCatalog && !intent.targetItem) {
      intent.isOutOfCatalog = true;
      intent.outOfCatalogDomain = previousContext.outOfCatalogDomain;
    } else {
      if (!intent.gender && previousContext.gender) intent.gender = previousContext.gender;
      if (!intent.categoryHint && previousContext.categoryHint) intent.categoryHint = previousContext.categoryHint;
      if (!intent.targetItem && previousContext.targetItem) intent.targetItem = previousContext.targetItem;
      if (intent.colors.length === 0 && previousContext.colors?.length > 0) intent.colors = [...previousContext.colors];
      if (intent.sizes.length === 0 && previousContext.sizes?.length > 0) intent.sizes = [...previousContext.sizes];
      if (intent.maxPrice === null && previousContext.maxPrice !== null) intent.maxPrice = previousContext.maxPrice;
      if (intent.minPrice === null && previousContext.minPrice !== null) intent.minPrice = previousContext.minPrice;
    }
  }

  return intent;
};

/**
 * Searches the catalog using interpreted intent and strict relevance filtering
 */
export const searchCatalog = async (intent, options = {}) => {
  const { merchantId = null, limit = 6 } = options;

  // If the query is out of catalog (e.g. food/ice cream), never search apparel or return irrelevant fallbacks
  if (intent.isOutOfCatalog) {
    return {
      products: [],
      reason: 'out_of_catalog',
      domain: intent.outOfCatalogDomain,
      totalMatches: 0,
    };
  }

  // Resolve Category ObjectId if categoryHint is present
  let categoryId = null;
  if (intent.categoryHint) {
    let catPattern;
    if (intent.categoryHint === "Men's Clothing") {
      catPattern = /^men['’]?s/i;
    } else if (intent.categoryHint === "Women's Clothing") {
      catPattern = /^women['’]?s/i;
    } else {
      catPattern = new RegExp(intent.categoryHint, 'i');
    }

    const catDoc = await Category.findOne({
      name: { $regex: catPattern },
      isActive: true,
    });
    if (catDoc) {
      categoryId = catDoc._id;
    }
  }

  // Base Mongo query
  const query = { isActive: true };
  if (merchantId) {
    query.merchant = merchantId;
  }

  if (categoryId) {
    query.category = categoryId;
  }

  // Price constraints
  if (intent.minPrice !== null || intent.maxPrice !== null) {
    query.price = {};
    if (intent.minPrice !== null) query.price.$gte = intent.minPrice;
    if (intent.maxPrice !== null) query.price.$lte = intent.maxPrice;
  }

  // Build text/regex match
  const conditions = [];

  // Keywords from targetItem
  if (intent.targetItem && intent.targetItem !== 'apparel' && intent.targetItem !== 'footwear' && intent.targetItem !== 'accessories') {
    const rawTokens = intent.targetItem.split(' ').filter(t => t.length > 2 && !CONTAINER_WORDS.has(t));
    if (rawTokens.length > 0) {
      const keywordRegexes = rawTokens.map(t => {
        // Singular / Plural flexibility
        const base = t.replace(/s$/, '');
        return new RegExp(base, 'i');
      });

      conditions.push({
        $or: [
          { name: { $in: keywordRegexes } },
          { description: { $in: keywordRegexes } },
        ]
      });
    }
  }

  if (conditions.length > 0) {
    query.$and = conditions;
  }

  // Fetch candidates from DB
  let candidates = await Product.find(query)
    .populate('category', 'name slug')
    .populate('brand', 'name slug')
    .sort({ soldCount: -1, createdAt: -1 })
    .lean();

  // In-memory precision filtering (Color, Size, Keyword Relevance)
  if (intent.colors.length > 0) {
    candidates = candidates.filter(prod => {
      const prodColors = (prod.colors || []).map(c => c.toLowerCase());
      const prodText = `${prod.name} ${prod.description}`.toLowerCase();

      return intent.colors.some(col => {
        const variants = COLOR_MAP[col] || [col];
        return variants.some(v => prodColors.includes(v) || prodText.includes(v));
      });
    });
  }

  if (intent.sizes.length > 0) {
    candidates = candidates.filter(prod => {
      const prodSizes = (prod.sizes || []).map(s => s.toUpperCase());
      return intent.sizes.some(sz => prodSizes.includes(sz));
    });
  }

  // Score candidates based on query relevance
  const scoredCandidates = candidates.map(prod => {
    let score = 10;
    const nameLower = prod.name.toLowerCase();
    const descLower = prod.description.toLowerCase();

    // Bonus for exact category match
    if (intent.categoryHint && prod.category?.name?.toLowerCase().includes(intent.categoryHint.toLowerCase())) {
      score += 25;
    }

    // Bonus for matching query tokens in product title
    if (intent.targetItem) {
      const tokens = intent.targetItem.split(' ').filter(t => t.length > 2);
      tokens.forEach(tok => {
        const base = tok.replace(/s$/, '');
        if (nameLower.includes(base)) score += 30;
        else if (descLower.includes(base)) score += 10;
      });
    }

    // Bonus for matching colors in title
    intent.colors.forEach(c => {
      if (nameLower.includes(c)) score += 15;
    });

    if (prod.featured) score += 5;
    if (prod.trending) score += 5;

    return { ...prod, relevanceScore: score };
  });

  scoredCandidates.sort((a, b) => b.relevanceScore - a.relevanceScore);

  const finalProducts = scoredCandidates.slice(0, limit);

  return {
    products: finalProducts,
    reason: finalProducts.length > 0 ? 'matched' : 'no_match',
    totalMatches: scoredCandidates.length,
  };
};
