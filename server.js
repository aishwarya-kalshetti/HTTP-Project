const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');

const PORT = process.env.PORT || 3000;
const API_V = '1.0';


const prodsPath = path.join(__dirname, 'products.json');
let prods = [];
function loadProds() {
	try {
		const raw = fs.readFileSync(prodsPath, 'utf-8');
		prods = JSON.parse(raw);
	} catch (err) {
		console.error('Failed to load products.json:', err);
		prods = [];
	}
}
loadProds();

function saveProds() {
	try {
		fs.writeFileSync(prodsPath, JSON.stringify(prods, null, '\t') + '\n', 'utf-8');
		return true;
	} catch (err) {
		console.error('Failed to save products.json:', err);
		return false;
	}
}

const app = express();


app.use(
	session({
		secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
		resave: false,
		saveUninitialized: true,
		cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
	})
);

app.use(express.json());


function apiVerGuard(req, res, next) {
	if (!req.path.startsWith('/api')) return next();
	const v = req.get('X-API-Version');
	if (!v) {
		return res.status(400).json({ error: 'Missing X-API-Version header' });
	}
	if (v !== API_V) {
		return res.status(426).json({ error: `Unsupported API version ${v}. Expected ${API_V}` });
	}
	next();
}
app.use(apiVerGuard);


function toNum(value) {
	const num = Number(value);
	return Number.isFinite(num) ? num : undefined;
}

function getCart(req) {
	if (!req.session.cart) {
		req.session.cart = []; 
	}
	return req.session.cart;
}

function findProd(id) {
	return prods.find((p) => String(p.id) === String(id));
}

// API: Products
// GET /api/products?search=&category=&minPrice=&maxPrice=&sort=price_asc|price_desc|name_asc|name_desc
app.get('/api/products', (req, res) => {
	const { search, category, minPrice, maxPrice, sort } = req.query;
let list = [...prods];

	if (search) {
		const s = String(search).toLowerCase();
		list = list.filter(
			(p) =>
				p.name.toLowerCase().includes(s) ||
				(p.description && p.description.toLowerCase().includes(s))
		);
	}
	if (category) {
		list = list.filter((p) => String(p.category).toLowerCase() === String(category).toLowerCase());
	}
const minP = toNum(minPrice);
const maxP = toNum(maxPrice);
	if (minP !== undefined) list = list.filter((p) => p.price >= minP);
	if (maxP !== undefined) list = list.filter((p) => p.price <= maxP);

	if (sort) {
		switch (sort) {
			case 'price_asc':
				list.sort((a, b) => a.price - b.price);
				break;
			case 'price_desc':
				list.sort((a, b) => b.price - a.price);
				break;
			case 'name_asc':
				list.sort((a, b) => a.name.localeCompare(b.name));
				break;
			case 'name_desc':
				list.sort((a, b) => b.name.localeCompare(a.name));
				break;
			default:
				break;
		}
	}

	res.json(list);
});

// GET /api/products/:id
app.get('/api/products/:id', (req, res) => {
const product = findProd(req.params.id);
	if (!product) {
		return res.status(404).json({ error: 'Product not found' });
	}
	res.json(product);
});

// POST /api/products { name, price, category, image, description }
app.post('/api/products', (req, res) => {
    const { name, price, category, image, description } = req.body || {};
    const numericPrice = Number(price);
    if (!name || price === undefined || !Number.isFinite(numericPrice)) {
        return res.status(400).json({ error: 'Valid name and price are required' });
    }
    const newId = prods.length ? Math.max(...prods.map((p) => Number(p.id))) + 1 : 1;
    const prod = {
        id: newId,
        name: String(name),
        price: numericPrice,
        category: category ? String(category) : '',
        image: image ? String(image) : '',
        description: description ? String(description) : '',
    };
    prods.push(prod);
    if (!saveProds()) return res.status(500).json({ error: 'Failed to persist product' });
    return res.status(201).json(prod);
});

// PATCH /api/products/:id { name?, price?, category?, image?, description? }
app.patch('/api/products/:id', (req, res) => {
    const prod = findProd(req.params.id);
    if (!prod) return res.status(404).json({ error: 'Product not found' });
    const { name, price, category, image, description } = req.body || {};
    if (name !== undefined) prod.name = String(name);
    if (price !== undefined) {
        const numericPrice = Number(price);
        if (!Number.isFinite(numericPrice)) return res.status(400).json({ error: 'Invalid price' });
        prod.price = numericPrice;
    }
    if (category !== undefined) prod.category = String(category);
    if (image !== undefined) prod.image = String(image);
    if (description !== undefined) prod.description = String(description);
    if (!saveProds()) return res.status(500).json({ error: 'Failed to persist product' });
    return res.json(prod);
});

// DELETE /api/products/:id

app.delete('/api/products/:id', (req, res) => {
	const idx = prods.findIndex((p) => String(p.id) === String(req.params.id));
	if (idx === -1) return res.status(404).json({ error: 'Product not found' });
	prods.splice(idx, 1);
	if (!saveProds()) return res.status(500).json({ error: 'Failed to persist product' });
	return res.json({ message: 'Deleted' });
});

// API: Cart
// GET /api/cart → current cart items with product details
app.get('/api/cart', (req, res) => {
const cart = getCart(req);
	const detailed = cart
		.map((item) => {
			const product = findProd(item.productId);
			if (!product) return undefined;
			return {
				productId: item.productId,
				quantity: item.quantity,
				product,
				subtotal: +(item.quantity * product.price).toFixed(2),
			};
		})
		.filter(Boolean);

	const total = detailed.reduce((sum, i) => sum + i.subtotal, 0);
	res.json({ items: detailed, total: +total.toFixed(2) });
});

// POST /api/cart { productId, quantity }
app.post('/api/cart', (req, res) => {
const { productId, quantity } = req.body || {};
const qty = toNum(quantity) ?? 1;
const prod = findProd(productId);
	if (!prod) return res.status(404).json({ error: 'Product not found' });
	if (qty <= 0) return res.status(400).json({ error: 'Quantity must be > 0' });

const cart = getCart(req);
	const existing = cart.find((c) => String(c.productId) === String(productId));
	if (existing) {
		existing.quantity += qty;
	} else {
		cart.push({ productId: prod.id, quantity: qty });
	}
	return res.status(201).json({ message: 'Added to cart' });
});

// PATCH /api/cart/:id { quantity }
app.patch('/api/cart/:id', (req, res) => {
	const productId = req.params.id;
const { quantity } = req.body || {};
const qty = toNum(quantity);
	if (qty === undefined) return res.status(400).json({ error: 'Quantity required' });
	if (qty < 0) return res.status(400).json({ error: 'Quantity cannot be negative' });

const cart = getCart(req);
	const existing = cart.find((c) => String(c.productId) === String(productId));
	if (!existing) return res.status(404).json({ error: 'Item not in cart' });

	if (qty === 0) {
		
		const idx = cart.findIndex((c) => String(c.productId) === String(productId));
		cart.splice(idx, 1);
		return res.json({ message: 'Removed from cart' });
	}

	existing.quantity = qty;
	return res.json({ message: 'Quantity updated' });
});

// DELETE /api/cart/:id
app.delete('/api/cart/:id', (req, res) => {
	const productId = req.params.id;
const cart = getCart(req);
	const idx = cart.findIndex((c) => String(c.productId) === String(productId));
	if (idx === -1) return res.status(404).json({ error: 'Item not in cart' });
	cart.splice(idx, 1);
	return res.json({ message: 'Removed from cart' });
});


app.use(express.static(path.join(__dirname, 'public')));

app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
	console.log(`Expect X-API-Version: ${API_V} on all API requests`);
});


