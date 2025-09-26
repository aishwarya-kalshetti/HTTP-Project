# QuickShop - E‑Commerce Cart API Demo

Single-page app with a Node.js + Express backend and session-based cart.

## Features
- Products API with filters, sorting, and search
- Cart CRUD: add, update quantity (including 0 to remove), delete, list with totals
- Session-scoped cart via cookies
- Required API version header `X-API-Version: 1.0`
- SPA with attractive dark UI

## all require header
- GET `/api/products` — query: `search`, `category`, `minPrice`, `maxPrice`, `sort`
- GET `/api/products/:id`
- GET `/api/cart`
- POST `/api/cart` — body: `{ productId, quantity }`
- PATCH `/api/cart/:id` — body: `{ quantity }` (0 deletes)
- DELETE `/api/cart/:id`

## Run

npm install
npm start
# open http://localhost:3000
```



