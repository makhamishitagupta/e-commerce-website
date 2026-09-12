// Check how many merchants exist and how products are distributed
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/luxestyle';

const ProductSchema = new mongoose.Schema({}, { strict: false });
const Product = mongoose.model('Product', ProductSchema, 'products');
const MerchantSchema = new mongoose.Schema({}, { strict: false });
const Merchant = mongoose.model('Merchant', MerchantSchema, 'merchants');

await mongoose.connect(MONGO_URI);

const merchants = await Merchant.find({}).lean();
console.log(`\nTotal Merchants: ${merchants.length}`);
for (const m of merchants) {
  const productCount = await Product.countDocuments({ merchant: m._id });
  console.log(`  - ${m.businessName || m.name || m._id} (status: ${m.status}) | products: ${productCount}`);
}

const productsWithNoMerchant = await Product.countDocuments({ merchant: null });
console.log(`\nProducts with NO merchant: ${productsWithNoMerchant}`);

// Check what happens if all items in cart are from the same merchant
const allProducts = await Product.find({}).select('name merchant').lean();
const merchantGroups = {};
for (const p of allProducts) {
  const mId = p.merchant?.toString() || 'null';
  if (!merchantGroups[mId]) merchantGroups[mId] = [];
  merchantGroups[mId].push(p.name);
}
console.log('\nProducts by merchant:');
for (const [mId, names] of Object.entries(merchantGroups)) {
  console.log(`  Merchant ${mId}: ${names.length} products`);
}

await mongoose.disconnect();
