// Fix broken product images in MongoDB
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/luxestyle';

const ProductSchema = new mongoose.Schema({}, { strict: false });
const Product = mongoose.model('Product', ProductSchema, 'products');

await mongoose.connect(MONGO_URI);

// Fix 1: Wells Marble Top End Table - replace google.com/imgres URL with a proper Unsplash image
const fix1 = await Product.updateOne(
  { slug: 'wells-marble-top-end-table-brown' },
  {
    $set: {
      images: [
        {
          url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&h=1000&fit=crop',
          publicId: 'wells-marble-table',
        },
      ],
    },
  }
);
console.log('Fix 1 (Wells Marble Table):', fix1.modifiedCount > 0 ? 'FIXED' : 'not modified');

// Fix 2: BHUMI LED String Light - replace encrypted-tbn0.gstatic.com with Unsplash
const fix2 = await Product.updateOne(
  { slug: 'bhumi-warm-white-12-meter-decorative-42-warm-white-led-string-light-plug' },
  {
    $set: {
      images: [
        {
          url: 'https://images.unsplash.com/photo-1612838320302-4b3b3b3b3b3b?w=800&h=1000&fit=crop',
          publicId: 'bhumi-led-lights',
        },
      ],
    },
  }
);

// If that URL doesn't exist, use a generic lights image
const fix2b = await Product.updateOne(
  { slug: 'bhumi-warm-white-12-meter-decorative-42-warm-white-led-string-light-plug' },
  {
    $set: {
      images: [
        {
          url: 'https://images.unsplash.com/photo-1513001900722-370f803f498d?w=800&h=1000&fit=crop',
          publicId: 'bhumi-led-lights',
        },
      ],
    },
  }
);
console.log('Fix 2 (BHUMI LED Lights):', fix2.modifiedCount > 0 || fix2b.modifiedCount > 0 ? 'FIXED' : 'not modified');

// Also fix the SKU for Wells product (was just "SKU" - not unique/meaningful)
const fix3 = await Product.updateOne(
  { slug: 'wells-marble-top-end-table-brown' },
  { $set: { sku: 'WMT-BROWN-001' } }
);
console.log('Fix 3 (Wells SKU):', fix3.modifiedCount > 0 ? 'FIXED' : 'not modified');

// Verify fixes
const products = await Product.find({ 
  slug: { $in: ['wells-marble-top-end-table-brown', 'bhumi-warm-white-12-meter-decorative-42-warm-white-led-string-light-plug'] }
}).lean();

console.log('\nVerification:');
for (const p of products) {
  console.log(`  ${p.name}: ${p.images[0]?.url?.substring(0, 70)}`);
}

await mongoose.disconnect();
console.log('\nDone!');
