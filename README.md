# E-Commerce API Integration — Shopify Payments

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Shopify](https://img.shields.io/badge/Shopify-7AB55C?style=for-the-badge&logo=shopify&logoColor=white)

A **production-grade headless e-commerce backend** demonstrating senior-level payment integration patterns with Shopify. Built with reliability-first architecture including idempotency, webhook resilience, and double-entry bookkeeping.

![Storefront Preview](shop.html)

---

## ✨ Features

### 🛒 E-Commerce Frontend
- Modern, responsive storefront UI with cart functionality
- Seamless Shopify checkout integration
- No login required — guest checkout flow

### 🔐 Production-Grade Backend
| Feature | Description |
|---------|-------------|
| **Idempotency** | Database-backed idempotency keys prevent duplicate transactions |
| **Webhook Resilience** | Dead Letter Queue (DLQ) with exponential backoff retries |
| **HMAC Verification** | Secure webhook signature validation |
| **Double-Entry Ledger** | Complete financial audit trail with debit/credit entries |
| **Stateful Orders** | Full order lifecycle tracking (Pending → Processing → Completed) |

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Express API    │────▶│   PostgreSQL    │
│   (Vanilla JS)  │     │   (TypeScript)   │     │   (Prisma ORM)  │
└─────────────────┘     └────────┬─────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ Shopify Webhooks │
                        │ (HMAC Verified)  │
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ Webhook Worker   │
                        │ (Background Job) │
                        └──────────────────┘
```

### Webhook Flow

```mermaid
sequenceDiagram
    participant Shopify
    participant API as Express API
    participant DB as PostgreSQL
    participant Worker as Webhook Worker

    Shopify->>API: POST /webhooks (HMAC signed)
    API->>API: Verify HMAC signature
    API->>DB: Store in WebhookEvent (RECEIVED)
    API-->>Shopify: 200 OK (fast response)
    
    Worker->>DB: Poll pending webhooks
    Worker->>Worker: Process webhook
    alt Success
        Worker->>DB: Update order/ledger
        Worker->>DB: Mark COMPLETED
    else Failure (< max retries)
        Worker->>DB: Mark FAILED + schedule retry
    else Failure (max retries exceeded)
        Worker->>DB: Move to DEAD_LETTER
        Worker->>Worker: Alert operations team
    end
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vanilla JavaScript, CSS |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | PostgreSQL |
| **ORM** | Prisma |
| **Payments** | Shopify Payments API |

---

## 📁 Project Structure

```
├── server/
│   ├── src/
│   │   ├── index.ts              # Express server entry point
│   │   ├── routes/
│   │   │   ├── checkout.routes.ts
│   │   │   ├── products.routes.ts
│   │   │   └── webhooks.routes.ts
│   │   ├── services/
│   │   │   ├── checkout.service.ts
│   │   │   ├── idempotency.service.ts    # ⭐ Idempotency implementation
│   │   │   ├── product.service.ts
│   │   │   └── webhook-processor.service.ts  # ⭐ DLQ + retry logic
│   │   ├── middleware/
│   │   │   └── hmac.middleware.ts        # ⭐ Webhook signature verification
│   │   └── workers/
│   │       └── webhook-worker.ts         # Background job processor
│   └── prisma/
│       └── schema.prisma                 # Database schema
├── shop.html                             # Storefront UI
├── shop.js                               # Frontend logic
└── shop.css                              # Styles
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Shopify development store (for full integration)

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/ecommerce-shopify-payments.git
cd ecommerce-shopify-payments

# Install root dependencies
npm install

# Install server dependencies
cd server && npm install
```

### 2. Configure Environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env` with your credentials:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/ecommerce"
SHOPIFY_STORE_DOMAIN="your-store.myshopify.com"
SHOPIFY_STOREFRONT_TOKEN="your-storefront-token"
SHOPIFY_WEBHOOK_SECRET="your-webhook-secret"
```

### 3. Set Up Database

```bash
cd server
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
```

### 4. Run the Application

```bash
# Terminal 1: Start the API server
npm run dev

# Terminal 2: Start the webhook worker (background processor)
npm run worker
```

### 5. Open the Storefront

Open `shop.html` in your browser or serve it with a local server.

---

## 🔑 Key Engineering Patterns

### Idempotency Service

Prevents duplicate transactions using database-backed idempotency keys:

```typescript
const result = await withIdempotency(
  `order-${orderId}-payment`,
  async () => {
    // This only executes once, even if called multiple times
    return processPayment(orderId);
  }
);
```

### Webhook Resilience

- **Immediate acknowledgment**: Store and respond 200 OK within milliseconds
- **Async processing**: Background worker handles business logic
- **Exponential backoff**: 1s → 5s → 30s → 5m → 30m
- **Dead Letter Queue**: Failed webhooks after 5 attempts are DLQ'd for manual review

### Double-Entry Bookkeeping

Every financial transaction creates balanced ledger entries:

```
Payment Received:
  DEBIT   Cash        $100.00
  CREDIT  Revenue     $100.00

Refund Issued:
  DEBIT   Revenue     $100.00
  CREDIT  Cash        $100.00
```

---

## 📊 Database Schema

### Core Models

| Model | Purpose |
|-------|---------|
| `Product` / `ProductVariant` | Product catalog synced from Shopify |
| `Order` / `OrderItem` | Order management with full lifecycle |
| `Transaction` | Payment/refund transaction records |
| `LedgerEntry` | Double-entry bookkeeping audit trail |
| `IdempotencyRecord` | Prevents duplicate API operations |
| `WebhookEvent` | Durable webhook queue with retry state |

---

## 🧪 API Endpoints

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/products` | List all products |
| `GET` | `/api/products/:id` | Get product details |

### Checkout
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/checkout` | Create Shopify checkout |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/webhooks/shopify` | Receive Shopify webhooks |
| `GET` | `/api/webhooks/dlq` | View Dead Letter Queue |
| `POST` | `/api/webhooks/dlq/:id/retry` | Retry a DLQ webhook |

---

## 📝 License

MIT

---

## 🙋 Author

Built as a demonstration of production-grade payment integration patterns.
