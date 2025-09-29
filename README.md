# QuickShop 

Single-page app with a Node.js + HTTP methods + dynamic cart.

## Demo
[Download and View the Demo](./HTTP.mp4)


## Features
- Products API with filters, sorting, and search
- Cart CRUD: add, update quantity (including 0 to remove), delete, list with totals
- Dynamic Cart(Total amount calculation)
- Required API version header `X-API-Version: 1.0`


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
