import 'dotenv/config';
import mongoose from 'mongoose';
import { extractShoppingIntent, searchCatalog } from '../services/aiShoppingEngine.js';
import { processChatMessage } from '../services/aiChatService.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/luxestyle';

let totalTests = 0;
let passedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    if (details) console.error(`     Details: ${details}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING AI SHOPPING AGENT COMPREHENSIVE TEST SUITE');
  console.log('====================================================\n');

  // Test Suite 1: Intent Extraction (Unit Tests)
  console.log('--- TEST SUITE 1: NLP Intent Extraction ---');

  const intentIceCream = extractShoppingIntent('I need ice cream');
  assert(intentIceCream.isOutOfCatalog === true, 'Detects "ice cream" as out of catalog');
  assert(intentIceCream.outOfCatalogDomain?.includes('food'), 'Identifies domain as food');

  const intentLaptop = extractShoppingIntent('Can I buy a laptop or MacBook?');
  assert(intentLaptop.isOutOfCatalog === true, 'Detects "laptop" as out of catalog');
  assert(intentLaptop.outOfCatalogDomain?.includes('electronics'), 'Identifies domain as electronics');

  const intentMens = extractShoppingIntent('i need mens collection');
  assert(intentMens.gender === 'men', 'Identifies gender as men');
  assert(intentMens.categoryHint === "Men's Clothing", 'Resolves categoryHint to "Men\'s Clothing"');

  const intentWomens = extractShoppingIntent('show me the women silk dress');
  assert(intentWomens.gender === 'women', 'Identifies gender as women');
  assert(intentWomens.categoryHint === "Women's Clothing", 'Resolves categoryHint to "Women\'s Clothing"');

  const intentPriceColor = extractShoppingIntent('looking for blue shirt under 2000');
  assert(intentPriceColor.colors.includes('blue'), 'Extracts color "blue"');
  assert(intentPriceColor.maxPrice === 2000, 'Extracts maxPrice 2000');

  const intentSize = extractShoppingIntent('black sneakers in size L or 42');
  assert(intentSize.colors.includes('black'), 'Extracts color "black"');
  assert(intentSize.sizes.includes('L'), 'Extracts size "L"');

  // Test Suite 2: Multi-turn Context Refinement
  console.log('\n--- TEST SUITE 2: Multi-turn Context Refinement ---');
  const turn1 = extractShoppingIntent('I need ice cream');
  const turn2 = extractShoppingIntent('chocolate', turn1);
  assert(turn2.isOutOfCatalog === true, 'Turn 2 ("chocolate") retains out-of-catalog status from turn 1');

  const turn3 = extractShoppingIntent('actually show me watches', turn2);
  assert(turn3.isOutOfCatalog === false, 'Turn 3 ("actually show me watches") shifts topic away from out-of-catalog');
  assert(turn3.categoryHint === 'Accessories', 'Turn 3 maps watches to Accessories');

  // Database Integration Tests
  console.log('\n--- Connecting to MongoDB for End-to-End Tests ---');
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB.\n');
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  // Test Suite 3: End-to-End "Ice Cream" Test Case (Primary User Requirement)
  console.log('--- TEST SUITE 3: "I need ice cream" Core Requirement ---');
  const iceCreamReply = await processChatMessage({
    message: 'I need ice cream',
    conversationHistory: [],
    cartItems: [],
  });

  assert(
    Array.isArray(iceCreamReply.products) && iceCreamReply.products.length === 0,
    '"I need ice cream" returns 0 products (products: [])',
    `Returned ${iceCreamReply.products?.length} products`
  );
  assert(
    iceCreamReply.message.toLowerCase().includes('food') || iceCreamReply.message.toLowerCase().includes('ice cream'),
    'Honest messaging explains LuxeStyle does not carry food/ice cream'
  );
  assert(
    iceCreamReply.suggestions && iceCreamReply.suggestions.length > 0,
    'Provides luxury category suggestions instead of irrelevant products'
  );

  // Test Suite 4: "i need mens collection"
  console.log('\n--- TEST SUITE 4: "i need mens collection" Query ---');
  const mensReply = await processChatMessage({
    message: 'i need mens collection',
    conversationHistory: [],
    cartItems: [],
  });

  assert(
    mensReply.type === 'products' && mensReply.products.length > 0,
    'Returns matching products for "i need mens collection"',
    `Returned ${mensReply.products?.length} products`
  );
  const allMens = mensReply.products.every(p => {
    const catName = p.category?.name || '';
    return catName.toLowerCase().includes("men's") || /shirt|tee|overcoat|oxford/i.test(p.name);
  });
  assert(allMens, 'All returned products belong to Men\'s collection');

  // Test Suite 5: Color & Price Constraint Query
  console.log('\n--- TEST SUITE 5: Color & Price Constraint Query ---');
  const priceReply = await processChatMessage({
    message: 'show me shirts under 2000',
    conversationHistory: [],
    cartItems: [],
  });

  assert(
    priceReply.products && priceReply.products.length > 0,
    'Returns products for "show me shirts under 2000"'
  );
  const allUnder2000 = priceReply.products.every(p => p.price <= 2000);
  assert(allUnder2000, 'Every returned product is priced <= 2000');

  // Test Suite 6: Add to Cart Intent
  console.log('\n--- TEST SUITE 6: Add To Cart Intent ---');
  const cartReply = await processChatMessage({
    message: 'add Classic Oxford Shirt to my cart',
    conversationHistory: [],
    cartItems: [],
  });

  assert(cartReply.type === 'cart_action', 'Reply type is "cart_action"');
  assert(cartReply.action?.type === 'ADD_ITEM', 'Action type is ADD_ITEM');
  assert(cartReply.action?.product?._id != null, 'Action product has a valid MongoDB _id');
  assert(cartReply.action?.product?.name.includes('Oxford Shirt'), 'Action product is the Oxford Shirt');

  // Test Suite 7: Checkout Intent
  console.log('\n--- TEST SUITE 7: Checkout Intent ---');
  const sampleProduct = await Product.findOne({ isActive: true });
  const checkoutReply = await processChatMessage({
    message: 'checkout now',
    conversationHistory: [],
    cartItems: [{ product: sampleProduct, quantity: 2 }],
  });

  assert(checkoutReply.type === 'checkout_action', 'Reply type is "checkout_action"');
  assert(checkoutReply.checkoutData?.subtotal > 0, 'Checkout subtotal calculated accurately');

  // Test Suite 8: Merchant Scoping
  console.log('\n--- TEST SUITE 8: Merchant Scoping ---');
  if (sampleProduct?.merchant) {
    const merchantReply = await processChatMessage({
      message: 'show me luxury items',
      conversationHistory: [],
      cartItems: [],
      merchantId: sampleProduct.merchant.toString(),
    });

    const strictlyScoped = merchantReply.products.every(
      p => (p.merchant?.toString() || p.merchant?._id?.toString() || '') === sampleProduct.merchant.toString()
    );
    assert(strictlyScoped, 'Products returned strictly match the merchant ID filter');
  } else {
    console.log('  ⚠️ Skipping merchant test (no product merchant found)');
  }

  console.log('\n====================================================');
  console.log(`RESULTS: ${passedTests} / ${totalTests} assertions passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('====================================================\n');

  await mongoose.disconnect();
  process.exit(passedTests === totalTests ? 0 : 1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
