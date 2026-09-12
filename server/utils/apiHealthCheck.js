// Full API health check script
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

const BASE = 'http://localhost:5000/api';

async function get(url) {
  const res = await fetch(url);
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

console.log('=== LuxeStyle API Health Check ===\n');

// 1. Products list
const products = await get(`${BASE}/products?limit=5`);
console.log(`[${products.ok ? 'OK' : 'FAIL'}] GET /products - status: ${products.status} | total: ${products.data.data?.pagination?.total}`);

// 2. Categories
const cats = await get(`${BASE}/categories`);
console.log(`[${cats.ok ? 'OK' : 'FAIL'}] GET /categories - status: ${cats.status} | count: ${cats.data.data?.length}`);

// 3. Brands
const brands = await get(`${BASE}/brands`);
console.log(`[${brands.ok ? 'OK' : 'FAIL'}] GET /brands - status: ${brands.status} | count: ${brands.data.data?.length}`);

// 4. Search
const search = await get(`${BASE}/products/search?q=shirt`);
console.log(`[${search.ok ? 'OK' : 'FAIL'}] GET /products/search?q=shirt - status: ${search.status} | results: ${search.data.data?.length}`);

// 5. Product detail by slug
const slug = products.data.data?.products?.[0]?.slug;
if (slug) {
  const detail = await get(`${BASE}/products/${slug}`);
  console.log(`[${detail.ok ? 'OK' : 'FAIL'}] GET /products/${slug} - status: ${detail.status} | name: ${detail.data.data?.name}`);
}

// 6. Cart (no auth - should get 401)
const cart = await get(`${BASE}/cart`);
console.log(`[${cart.status === 401 ? 'OK' : 'WARN'}] GET /cart (unauthenticated) - status: ${cart.status} (expected 401)`);

// 7. Orders (no auth - should get 401)
const orders = await get(`${BASE}/orders`);
console.log(`[${orders.status === 401 ? 'OK' : 'WARN'}] GET /orders (unauthenticated) - status: ${orders.status} (expected 401)`);

// 8. Sort options
const sortNewest = await get(`${BASE}/products?sort=newest&limit=3`);
console.log(`[${sortNewest.ok ? 'OK' : 'FAIL'}] GET /products?sort=newest - status: ${sortNewest.status}`);

const sortPriceAsc = await get(`${BASE}/products?sort=price-asc&limit=3`);
const prices = sortPriceAsc.data.data?.products?.map(p => p.price) || [];
const isSorted = prices.every((v, i) => i === 0 || v >= prices[i - 1]);
console.log(`[${sortPriceAsc.ok && isSorted ? 'OK' : 'FAIL'}] GET /products?sort=price-asc - prices: ${prices.join(', ')} | sorted: ${isSorted}`);

// 9. Category filter
if (cats.data.data?.length > 0) {
  const catId = cats.data.data[0]._id;
  const catName = cats.data.data[0].name;
  const filtered = await get(`${BASE}/products?category=${catId}&limit=5`);
  console.log(`[${filtered.ok ? 'OK' : 'FAIL'}] GET /products?category=${catId} (${catName}) - status: ${filtered.status} | count: ${filtered.data.data?.products?.length}`);
}

// 10. Pagination
const page2 = await get(`${BASE}/products?page=2&limit=5`);
console.log(`[${page2.ok ? 'OK' : 'FAIL'}] GET /products?page=2 - status: ${page2.status} | products: ${page2.data.data?.products?.length} | page: ${page2.data.data?.pagination?.page}`);

// 11. Trending
const trending = await get(`${BASE}/products?trending=true&limit=5`);
console.log(`[${trending.ok ? 'OK' : 'FAIL'}] GET /products?trending=true - status: ${trending.status} | count: ${trending.data.data?.products?.length}`);

// 12. Search with empty term
const emptySearch = await get(`${BASE}/products/search?q=`);
console.log(`[${emptySearch.ok ? 'OK' : 'FAIL'}] GET /products/search?q= (empty) - status: ${emptySearch.status} | results: ${emptySearch.data.data?.length ?? JSON.stringify(emptySearch.data.data)}`);

// 13. Non-existent product slug
const notFound = await get(`${BASE}/products/this-does-not-exist-xyz`);
console.log(`[${notFound.status === 404 ? 'OK' : 'FAIL'}] GET /products/nonexistent - status: ${notFound.status} (expected 404)`);

console.log('\n=== All checks complete ===');
