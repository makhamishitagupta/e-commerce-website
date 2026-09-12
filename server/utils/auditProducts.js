// Quick audit script - run with: node server/utils/auditProducts.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/luxestyle';

const ProductSchema = new mongoose.Schema({}, { strict: false });
const Product = mongoose.model('Product', ProductSchema, 'products');

await mongoose.connect(MONGO_URI);
const products = await Product.find({}).lean();

console.log(`\nTotal products: ${products.length}\n`);

let brokenImages = 0;
let missingImages = 0;
let googleSearchImages = 0;
let encryptedTbnImages = 0;
let goodImages = 0;

for (const p of products) {
  const img = p.images?.[0]?.url || '';
  const imgShort = img.substring(0, 80);
  
  if (!img) {
    missingImages++;
    console.log(`[MISSING IMG] ${p.name}`);
  } else if (img.includes('google.com/imgres') || img.includes('google.com/search')) {
    googleSearchImages++;
    console.log(`[GOOGLE SEARCH IMG] ${p.name} → ${imgShort}...`);
  } else if (img.includes('encrypted-tbn0.gstatic.com')) {
    encryptedTbnImages++;
    console.log(`[ENCRYPTED TBN IMG] ${p.name} → ${imgShort}...`);
  } else if (img.startsWith('http')) {
    goodImages++;
    console.log(`[OK] ${p.name} → ${imgShort}`);
  } else {
    brokenImages++;
    console.log(`[BROKEN IMG] ${p.name} → ${imgShort}`);
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`Total: ${products.length}`);
console.log(`Good images: ${goodImages}`);
console.log(`Missing images: ${missingImages}`);
console.log(`Google Search URLs (will 404 in browser): ${googleSearchImages}`);
console.log(`Encrypted TBN (may load but unreliable): ${encryptedTbnImages}`);
console.log(`Other broken: ${brokenImages}`);

await mongoose.disconnect();
