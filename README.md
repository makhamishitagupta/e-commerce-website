# LuxeStyle — AI-Powered Agentic E-Commerce Platform

> Full-stack MERN e-commerce platform with autonomous AI agent commerce, Razorpay TEST checkout with cryptographic verification, a merchant intelligence dashboard, and an AI shopping concierge.

**🌐 Live Demo:** [https://e-commerce-website-1-nyjg.onrender.com/](https://e-commerce-website-1-nyjg.onrender.com/)

---

## Table of Contents

- [Feature Overview](#-feature-overview)
- [Tech Stack](#-tech-stack)
- [Quick Setup](#-quick-setup)
- [AI Agent Integration Guide](#-ai-agent-integration-guide)
- [Razorpay TEST Configuration](#-razorpay-test-configuration)
- [Merchant Portal](#-merchant-portal)
- [AI Shopping Concierge](#-ai-shopping-concierge)
- [Security Architecture](#-security-architecture)
- [Agent Key Handling](#agent-key-handling)
- [Running the E2E Verification Test](#-running-the-e2e-verification-test)

---

## 🎯 Feature Overview

| Feature | Description |
| --- | --- |
| Storefront | Catalog, cart, wishlist, search |
| Authentication & Roles | Clerk-based auth with `admin`, `merchant`, `user` roles |
| Admin Panel | Products, orders, customers, reports |
| Merchant Onboarding | Store registration and portal access |
| AI Transaction Intelligence | Market basket analysis on order history |
| Bundle Suggestions | AI-suggested bundles with merchant approval workflow |
| Agent-Ready Commerce API | `/api/agent/v1` endpoints for autonomous agents |
| OpenAPI & Tool Schemas | OpenAPI 3.0 spec + LLM function-calling tool definitions |
| AI Shopping Concierge | Conversational shopping assistant (floating chat drawer) |
| Razorpay TEST Checkout | HMAC-SHA256 signature verification |
| Agentic Checkout Session | Requires explicit customer authorization before payment |
| Merchant AI Dashboard | Revenue, analytics, and agent commerce stats |
| Persistence | MongoDB-backed — all features are real, no mocked data |

---

## 🛠 Tech Stack

- **Frontend:** React (Vite)
- **Backend:** Node.js, Express
- **Database:** MongoDB
- **Auth:** Clerk
- **Payments:** Razorpay (TEST mode)
- **Hosting:** Render ([live demo](https://e-commerce-website-1-nyjg.onrender.com/))

---

## 🚀 Quick Setup

### Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)

### 1. Clone & Install

```bash
git clone <repository-url>
cd LuxeStyle-Ecommerce-website

# Server dependencies
cd server
npm install

# Client dependencies
cd ../client
npm install
```

### 2. Configure Environment Variables

```bash
# Server
cd server
cp .env.example .env

# Client
cd ../client
cp .env.example .env
```

Fill in your credentials (MongoDB URI, Clerk keys, Razorpay keys, etc.) in both `.env` files.

### 3. Seed the Database

```bash
cd server
npm run seed
```

This seeds:

- 4 categories, 4 brands, **12 luxury products**
- **1 flagship merchant store** (LuxeStyle Flagship Atelier)
- **29 historical orders** with multi-item co-purchase baskets for transaction intelligence
- **2 AI bundle offers** (1 approved, 1 pending)
- An **agent API key**, generated from the merchant portal after onboarding

### 4. Start Development Servers

```bash
# Terminal 1: Server
cd server && npm run dev

# Terminal 2: Client
cd client && npm run dev
```

Visit **http://localhost:5173** to run locally, or try the [live demo](https://e-commerce-website-1-nyjg.onrender.com/) directly.

---

## 🤖 AI Agent Integration Guide

### Authentication

All agent endpoints require a merchant-issued API key via the `X-Agent-Key` header:

```http
X-Agent-Key: YOUR_MERCHANT_AGENT_KEY
```

### Base URL

```
http://localhost:5000/api/agent/v1/
```

### Machine-Readable Specs

```bash
# OpenAPI 3.0 specification
curl http://localhost:5000/api/agent/v1/openapi.json

# Function-calling tool definitions (Gemini / OpenAI / Claude)
curl http://localhost:5000/api/agent/v1/tools
```

### Complete Agent Commerce Flow

| Step | Action | Endpoint |
| --- | --- | --- |
| 1 | Search catalog | `GET /catalog?query=dress&maxPrice=5000` |
| 2 | Get approved bundle offers | `GET /offers` |
| 3 | Check availability | `POST /check-availability` |
| 4 | Create agent cart | `POST /cart` |
| 5 | Add item to cart | `POST /cart/CART_ID/items` |
| 6 | Apply approved bundle | `POST /cart/CART_ID/apply-bundle` |
| 7 | Initiate checkout (pauses for customer authorization) | `POST /checkout/initiate` |
| 8 | Verify payment (HMAC-SHA256) | `POST /checkout/verify` |

<details>
<summary><strong>Full curl examples</strong></summary>

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

# 7. Initiate agentic checkout — pauses for explicit customer authorization
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

</details>

---

## 💳 Razorpay TEST Configuration

### Getting Test API Keys

1. Sign up at [dashboard.razorpay.com](https://dashboard.razorpay.com)
2. Navigate to **Settings → API Keys**
3. Ensure you're in **Test Mode** (toggle at the top)
4. Click **Generate Test Key**
5. Copy your `Key ID` (`rzp_test_...`) and `Key Secret`
6. Add them to `server/.env`:

```env
RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_KEY_SECRET
```

### Test Card Numbers

| Card | Number | CVV | Expiry |
| --- | --- | --- | --- |
| Visa (Success) | 4111 1111 1111 1111 | Any 3 digits | Any future date |
| Mastercard (Success) | 5104 0155 5555 5558 | Any 3 digits | Any future date |
| UPI (Success) | `success@razorpay` | — | — |

### Simulation Mode (No API Keys Required)

If Razorpay keys aren't configured, the app automatically falls back to a **browser simulation mode** that:

- Generates a local Razorpay order ID
- Shows a browser confirmation dialog simulating the payment popup
- Performs real HMAC-SHA256 verification using a development signature format
- Creates a real MongoDB order with `paymentStatus: 'paid'`

---

## 🏪 Merchant Portal

### Access

- Local: navigate to `http://localhost:5173/merchant` or click **Merchant Portal** in the navbar
- Live demo: click **Merchant Portal** at [e-commerce-website-1-nyjg.onrender.com](https://e-commerce-website-1-nyjg.onrender.com/)

Click **Launch Flagship Store Demo →** for instant access with pre-seeded historical data.

### Dashboard Tabs

| Tab | Contents |
| --- | --- |
| **Overview & Sales** | Revenue metrics, agent vs. direct breakdown, recent orders, low stock alerts |
| **AI Transaction Intelligence** | Run correlation analysis, review AI-suggested bundles, approve/reject, view live bundles |
| **Agent Commerce Hub & APIs** | API key management, interactive agent sandbox, OpenAPI & Tools JSON viewer |
| **Products** | Merchant catalog with stock and sales data |
| **Orders** | Order history with agent/direct source attribution |

### Running AI Transaction Intelligence

1. Go to **Merchant Portal → AI Transaction Intelligence**
2. Click **Run Intelligence Scan Now**
3. The system analyzes all MongoDB orders and computes:
   - **Support** — how often two items are purchased together
   - **Confidence** — probability of buying B given a purchase of A
   - **Lift** — statistical significance ratio (> 1.0 = positive correlation)
4. High-lift combinations are suggested as bundle offers
5. Review each suggestion and click **✓ Approve & Activate** to make it live in the agent catalog

---

## 🛍️ AI Shopping Concierge

A floating **AI Concierge** button (bottom-right on all pages) opens a conversational shopping assistant that:

- Searches the luxury product catalog with natural language
- Returns interactive product cards with **Add to Cart** buttons
- Displays approved bundle offer cards with savings percentages
- Provides a Razorpay TEST checkout authorization card
- Syncs in real time with the cart (count badge updates instantly)

**Example queries:**

- "Show me silk dresses under ₹5000"
- "Show bundle deals"
- "Add Oxford Shirt to my bag"
- "I want to checkout"
- "Men's clothing"

---

## 🔒 Security Architecture

| Layer | Implementation |
| --- | --- |
| User Auth | Clerk JWT validation via `@clerk/express` |
| Agent Auth | HMAC-SHA256 hashed API keys in MongoDB, constant-time comparison |
| Payment Verification | Razorpay HMAC-SHA256 signature verification (`razorpay_order_id` + `razorpay_payment_id`) |
| Human Authorization | Agentic checkouts always require explicit customer approval — agents cannot auto-pay |
| Scope Permissions | Agent keys can be scoped to `catalog:read`, `cart:write`, `checkout:write`, `analytics:read` |
| Role-Based Access | `admin`, `merchant`, `user` roles, all enforced server-side |

---

## Agent Key Handling

Create an agent key from the authenticated Merchant Portal. The raw key is shown **only once** — store it securely and use it in the `X-Agent-Key` header.

---

## 📊 Running the E2E Verification Test

```bash
cd server
node utils/testCompleteFlow.js
```

This validates all 13 steps of the complete flow in a single run.
