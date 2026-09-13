# LuxeStyle — AI-Powered Agentic E-Commerce Platform

> Full-stack MERN e-commerce platform with autonomous AI agent commerce, Razorpay TEST checkout with cryptographic verification, merchant intelligence dashboard, and an AI shopping concierge.

---

## 🎯 Feature Overview

| Feature                                                 | 
| ------------------------------------------------------- | 
| Storefront (Catalog, Cart, Wishlist, Search)            | 
| Clerk Authentication & Role Management                  | 
| Admin Panel (Products, Orders, Customers, Reports)      | 
| Merchant Onboarding & Store Registration                | 
| AI Transaction Intelligence (Market Basket Analysis)    | 
| Bundle Suggestion & Merchant Approval Workflow          | 
| Agent-Ready Commerce API (`/api/agent/v1`)              | 
| OpenAPI 3.0 Specification & LLM Tool Schemas            | 
| AI Shopping Concierge Chat (Float Drawer)               | 
| Razorpay TEST Checkout with HMAC-SHA256 Verification    | 
| Agentic Checkout Session (Customer Authorization)       | 
| Merchant AI Dashboard (Revenue, Analytics, Agent Stats) | 
| MongoDB Persistence (all features real — no mocks)      | 

---

## 🚀 Quick Setup

### Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)

### 1. Clone & Install

```bash
# Clone repository
git clone <repository-url>
cd LuxeStyle-Ecommerce-website

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Server Environment

Copy the example and fill in your credentials:

```bash
cd server
cp .env.example .env
```

### 3. Client Environment

```bash
cd client
cp .env.example .env
```

### 4. Seed the Database

```bash
cd server
npm run seed
```

This seeds:

- 4 categories, 4 brands, **12 luxury products**
- **1 flagship merchant store** (LuxeStyle Flagship Atelier)
- **29 historical orders** with multi-item co-purchase baskets for transaction intelligence
- **2 AI bundle offers** (1 approved, 1 pending)
- **Agent API key**: generated from the merchant portal after onboarding

### 5. Start Development Servers

```bash
# Terminal 1: Server
cd server && npm run dev

# Terminal 2: Client
cd client && npm run dev
```

Visit: **http://localhost:5173**

---

## 🤖 AI Agent Integration Guide

### Authentication

All agent endpoints require a merchant-issued API key via `X-Agent-Key` header:

```http
X-Agent-Key: YOUR_MERCHANT_AGENT_KEY
```

### Base URL

```
http://localhost:5000/api/agent/v1/
```

### Getting Machine-Readable Specs

```bash
# OpenAPI 3.0 Specification
curl http://localhost:5000/api/agent/v1/openapi.json

# Function Calling Tool Definitions (for Gemini / OpenAI / Claude)
curl http://localhost:5000/api/agent/v1/tools
```

### Complete Agent Commerce Flow

```bash
# 1. Search catalog
curl -H "X-Agent-Key: YOUR_MERCHANT_AGENT_KEY" \
  "http://localhost:5000/api/agent/v1/catalog?query=dress&maxPrice=5000"

# 2. Get approved bundle offers
curl -H "X-Agent-Key: YOUR_MERCHANT_AGENT_KEY" \
  "http://localhost:5000/api/agent/v1/offers"

# 3. Check availability
curl -X POST -H "X-Agent-Key: YOUR_MERCHANT_AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":"PRODUCT_ID","quantity":1}]}' \
  "http://localhost:5000/api/agent/v1/check-availability"

# 4. Create agent cart
curl -X POST -H "X-Agent-Key: YOUR_MERCHANT_AGENT_KEY" \
  "http://localhost:5000/api/agent/v1/cart"

# 5. Add item to cart
curl -X POST -H "X-Agent-Key: YOUR_MERCHANT_AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"productId":"PRODUCT_ID","quantity":1}' \
  "http://localhost:5000/api/agent/v1/cart/CART_ID/items"

# 6. Apply approved bundle
curl -X POST -H "X-Agent-Key: YOUR_MERCHANT_AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"bundleId":"BUNDLE_ID"}' \
  "http://localhost:5000/api/agent/v1/cart/CART_ID/apply-bundle"

# 7. Initiate agentic checkout — PAUSES for explicit customer authorization
curl -X POST -H "X-Agent-Key: YOUR_MERCHANT_AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "cartId":"CART_ID",
    "customerInfo":{"fullName":"Jane Doe","email":"jane@example.com","phone":"+91 99001 22334"},
    "shippingAddress":{"line1":"12 Elm Street","city":"Mumbai","state":"Maharashtra","postalCode":"400001"}
  }' \
  "http://localhost:5000/api/agent/v1/checkout/initiate"
# Returns: sessionId + authorizationUrl + Razorpay orderId

# 8. Customer authorizes → verify payment (HMAC-SHA256)
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "sessionId":"SESSION_ID",
    "razorpay_order_id":"order_xxx",
    "razorpay_payment_id":"pay_xxx",
    "razorpay_signature":"SIGNATURE"
  }' \
  "http://localhost:5000/api/agent/v1/checkout/verify"
```

---

## 💳 Razorpay TEST Configuration

### Getting Test API Keys

1. Sign up at [dashboard.razorpay.com](https://dashboard.razorpay.com)
2. Navigate to **Settings → API Keys**
3. Ensure you are in **Test Mode** (toggle at the top)
4. Click **"Generate Test Key"**
5. Copy your `Key ID` (rzp*test*...) and `Key Secret`
6. Add to `server/.env`:

```env
RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_KEY_SECRET
```

### Test Card Numbers (Razorpay TEST Mode)

| Card                 | Number              | CVV          | Expiry          |
| -------------------- | ------------------- | ------------ | --------------- |
| Visa (Success)       | 4111 1111 1111 1111 | Any 3 digits | Any future date |
| Mastercard (Success) | 5104 0155 5555 5558 | Any          | Any future      |
| UPI (Success)        | success@razorpay    | —            | —               |

### Simulation Mode (No API Keys Required)

If Razorpay keys are not configured, the system automatically activates a **browser simulation mode** that:

- Generates a local Razorpay order ID
- Shows a browser confirmation dialog simulating the payment popup
- Performs **real HMAC-SHA256 verification** with the development signature format
- Creates a real MongoDB order with `paymentStatus: 'paid'`

---

## 🏪 Merchant Portal

### Access

Navigate to **http://localhost:5173/merchant** or click "Merchant Portal" in the navbar.

Click **"Launch Flagship Store Demo →"** for instant access with pre-seeded historical data.

### Dashboard Tabs

| Tab                             | Contents                                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| **Overview & Sales**            | Revenue metrics, Agent vs Direct breakdown, recent orders, low stock alerts              |
| **AI Transaction Intelligence** | Run correlation analysis, review AI-suggested bundles, approve/reject, view live bundles |
| **Agent Commerce Hub & APIs**   | API key management, interactive agent sandbox, OpenAPI & Tools JSON viewer               |
| **Products**                    | Merchant catalog with stock and sales data                                               |
| **Orders**                      | Order history with agent/direct source attribution                                       |

### Running AI Transaction Intelligence

1. Go to **Merchant Portal → AI Transaction Intelligence** tab
2. Click **"Run Intelligence Scan Now"**
3. The system analyzes all MongoDB orders and computes:
   - **Support** — how often two items are purchased together
   - **Confidence** — probability of buying B given purchase of A
   - **Lift** — statistical significance ratio (>1.0 = positive correlation)
4. Suggests high-lift combinations as bundle offers
5. Review each suggestion and click **"✓ Approve & Activate"** to make it live in the agent catalog

---

## 🛍️ AI Shopping Concierge

The **floating AI Concierge button** (bottom-right on all pages) opens a conversational shopping assistant that:

- Searches the luxury product catalog with natural language
- Returns **interactive product cards** with "Add to Cart" buttons
- Displays **approved bundle offer cards** with savings percentages
- Provides a **Razorpay TEST checkout authorization card** for checkout
- Syncs in real-time with the cart (count badge updates instantly)

**Example queries:**

- "Show me silk dresses under ₹5000"
- "Show bundle deals"
- "Add Oxford Shirt to my bag"
- "I want to checkout"
- "Men's clothing"


---

## 🔒 Security Architecture

| Layer                | Implementation                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| User Auth            | Clerk JWT validation via `@clerk/express`                                                                          |
| Agent Auth           | HMAC-SHA256 hashed API keys stored in MongoDB, constant-time comparison                                            |
| Payment Verification | Razorpay HMAC-SHA256 signature verification with `razorpay_order_id + razorpay_payment_id`                         |
| Human Authorization  | Agentic checkouts **always** require explicit customer approval — agents cannot auto-pay                           |
| Scope Permissions    | Agent keys can be restricted to specific scopes (`catalog:read`, `cart:write`, `checkout:write`, `analytics:read`) |
| Role-Based Access    | `admin`, `merchant`, `user` roles, all enforced server-side                                                        |

---

## Agent Key Handling

Create an agent key from the authenticated Merchant Portal. The raw key is shown only once; store it securely and use it in the `X-Agent-Key` header.

---

## 📊 Running the E2E Verification Test

```bash
cd server
node utils/testCompleteFlow.js
```

This validates all 13 steps of the complete flow in a single run.
