const API_VERSION = '1.0';

async function apiFetch(url, options = {}) {
	const res = await fetch(url, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			'X-API-Version': API_VERSION,
			...(options.headers || {}),
		},
		credentials: 'same-origin',
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err.error || `Request failed: ${res.status}`);
	}
	return res.json();
}

function formatCurrency(num) {
	return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(num);
}

const state = {
	products: [],
	filters: { search: '', category: '', sort: '' },
	manageOpen: false,
};

async function loadProducts() {
	const params = new URLSearchParams();
	if (state.filters.search) params.set('search', state.filters.search);
	if (state.filters.category) params.set('category', state.filters.category);
	if (state.filters.sort) params.set('sort', state.filters.sort);
	state.products = await apiFetch(`/api/products?${params.toString()}`);
	renderProducts();
}

async function loadCart() {
	const data = await apiFetch('/api/cart');
	renderCart(data);
}

function renderProducts() {
	const grid = document.getElementById('productsGrid');
	const tpl = document.getElementById('productCardTpl');
	grid.innerHTML = '';
	state.products.forEach((p) => {
		const node = tpl.content.cloneNode(true);
		const card = node.querySelector('.card');
		card.dataset.id = p.id;
		node.querySelector('.thumb').src = p.image;
		node.querySelector('.thumb').alt = p.name;
		node.querySelector('.title').textContent = p.name;
		node.querySelector('.desc').textContent = p.description || '';
		node.querySelector('.price').textContent = formatCurrency(p.price);
		const input = node.querySelector('.qty-input');
		node.querySelector('.qty-inc').addEventListener('click', () => {
			input.value = String(Math.max(1, (parseInt(input.value) || 1) + 1));
		});
		node.querySelector('.qty-dec').addEventListener('click', () => {
			input.value = String(Math.max(1, (parseInt(input.value) || 1) - 1));
		});
		node.querySelector('.add-btn').addEventListener('click', async () => {
			try {
				const qty = Math.max(1, parseInt(input.value) || 1);
				await apiFetch('/api/cart', { method: 'POST', body: JSON.stringify({ productId: p.id, quantity: qty }) });
				await refreshCartCount();
				openCart();
			} catch (e) {
				alert(e.message);
			}
		});

		if (state.manageOpen) {
			const actions = document.createElement('div');
			actions.style.display = 'flex';
			actions.style.gap = '8px';
			actions.style.marginTop = '8px';
			const editBtn = document.createElement('button');
			editBtn.className = 'btn';
			editBtn.textContent = 'Edit';
			const delBtn = document.createElement('button');
			delBtn.className = 'btn';
			delBtn.style.background = 'linear-gradient(135deg, #ff5577, #ff7792)';
			delBtn.textContent = 'Delete';
			actions.append(editBtn, delBtn);
			node.querySelector('.card-body').appendChild(actions);
			editBtn.addEventListener('click', () => fillFormForEdit(p));
			delBtn.addEventListener('click', async () => {
				if (!confirm('Delete this product?')) return;
				try { await apiFetch(`/api/products/${p.id}`, { method: 'DELETE' }); await loadProducts(); } catch(e){ alert(e.message); }
			});
		}
		grid.appendChild(node);
	});
}

function renderCart(data) {
	const list = document.getElementById('cartItems');
	const totalEl = document.getElementById('cartTotal');
	list.innerHTML = '';
	data.items.forEach((item) => {
		const li = document.createElement('li');
		li.innerHTML = `
			<img src="${item.product.image}" alt="${item.product.name}">
			<div>
				<p class="item-title">${item.product.name}</p>
				<p class="item-price">${formatCurrency(item.product.price)} × ${item.quantity} = ${formatCurrency(item.subtotal)}</p>
				<div class="item-actions">
					<button class="icon" data-action="dec">-</button>
					<input class="qty-input" type="number" min="0" value="${item.quantity}">
					<button class="icon" data-action="inc">+</button>
					<button class="icon" data-action="remove" title="Remove">🗑️</button>
				</div>
			</div>
			<div>${formatCurrency(item.product.price)}</div>
		`;
		list.appendChild(li);

		const input = li.querySelector('input.qty-input');
		const doUpdate = async (newQty) => {
			try {
				await apiFetch(`/api/cart/${item.productId}`, { method: 'PATCH', body: JSON.stringify({ quantity: newQty }) });
				await refreshCart();
			} catch (e) { alert(e.message); }
		};
		li.querySelector('[data-action="dec"]').addEventListener('click', () => { input.value = String(Math.max(0, (parseInt(input.value)||0) - 1)); doUpdate(parseInt(input.value)||0); });
		li.querySelector('[data-action="inc"]').addEventListener('click', () => { input.value = String((parseInt(input.value)||0) + 1); doUpdate(parseInt(input.value)||0); });
		li.querySelector('[data-action="remove"]').addEventListener('click', async () => { try { await apiFetch(`/api/cart/${item.productId}`, { method: 'DELETE' }); await refreshCart(); } catch(e){ alert(e.message); } });
		input.addEventListener('change', () => doUpdate(parseInt(input.value)||0));
	});
	const count = data.items.reduce((sum, i) => sum + i.quantity, 0);
	document.getElementById('cartCount').textContent = String(count);
	totalEl.textContent = formatCurrency(data.total);
	document.getElementById('checkoutBtn').disabled = data.items.length === 0;
}

async function refreshCart() {
	const data = await apiFetch('/api/cart');
	renderCart(data);
}

async function refreshCartCount() {
	const data = await apiFetch('/api/cart');
	const count = data.items.reduce((sum, i) => sum + i.quantity, 0);
	document.getElementById('cartCount').textContent = String(count);
}

function openCart() {
	const panel = document.getElementById('cartPanel');
	panel.classList.remove('hidden');
	panel.setAttribute('aria-hidden', 'false');
	refreshCart();
}
function closeCart() {
	const panel = document.getElementById('cartPanel');
	panel.classList.add('hidden');
	panel.setAttribute('aria-hidden', 'true');
}

function bindUI() {
	const searchInput = document.getElementById('searchInput');
	const categoryFilter = document.getElementById('categoryFilter');
	const sortSelect = document.getElementById('sortSelect');
	searchInput.addEventListener('input', debounce(() => { state.filters.search = searchInput.value.trim(); loadProducts(); }, 250));
	categoryFilter.addEventListener('change', () => { state.filters.category = categoryFilter.value; loadProducts(); });
	sortSelect.addEventListener('change', () => { state.filters.sort = sortSelect.value; loadProducts(); });

	
	const manageToggle = document.getElementById('manageToggle');
	const managePanel = document.getElementById('managePanel');
	if (manageToggle && managePanel) {
		manageToggle.addEventListener('click', () => {
			state.manageOpen = !state.manageOpen;
			managePanel.classList.toggle('hidden', !state.manageOpen);
			manageToggle.classList.toggle('btn-primary', state.manageOpen);
			renderProducts();
		});

		const form = document.getElementById('productForm');
		const fId = document.getElementById('fId');
		const fName = document.getElementById('fName');
		const fPrice = document.getElementById('fPrice');
		const fCategory = document.getElementById('fCategory');
		const fImage = document.getElementById('fImage');
		const fDesc = document.getElementById('fDesc');
		const formReset = document.getElementById('formReset');
		if (form) {
			form.addEventListener('submit', async (e) => {
				e.preventDefault();
				const priceNum = parseFloat(fPrice.value || '');
				if (!fName.value.trim() || !Number.isFinite(priceNum)) {
					alert('Please provide a valid name and price');
					return;
				}
				const body = { name: fName.value.trim(), price: priceNum, category: fCategory.value.trim(), image: fImage.value.trim(), description: fDesc.value.trim() };
				try {
					if (fId.value) {
						await apiFetch(`/api/products/${fId.value}`, { method: 'PATCH', body: JSON.stringify(body) });
					} else {
						await apiFetch('/api/products', { method: 'POST', body: JSON.stringify(body) });
					}
					clearForm();
					await loadProducts();
				} catch(e){ alert(e.message); }
			});
		}
		if (formReset) formReset.addEventListener('click', clearForm);

		function clearForm(){ fId.value=''; fName.value=''; fPrice.value=''; fCategory.value=''; fImage.value=''; fDesc.value=''; }
		window.fillFormForEdit = function(p){
			fId.value = p.id; fName.value = p.name; fPrice.value = String(p.price); fCategory.value = p.category || ''; fImage.value = p.image || ''; fDesc.value = p.description || '';
			if (!state.manageOpen) { state.manageOpen = true; managePanel.classList.remove('hidden'); manageToggle.classList.add('btn-primary'); }
		};
	}

	document.getElementById('cartToggle').addEventListener('click', () => {
		const panel = document.getElementById('cartPanel');
		if (panel.classList.contains('hidden')) openCart(); else closeCart();
	});
	document.getElementById('closeCart').addEventListener('click', closeCart);

	document.getElementById('checkoutBtn').addEventListener('click', () => {
		alert('Demo only: Implement payment flow in a real app.');
	});
}

function debounce(fn, ms) {
	let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}


bindUI();
loadProducts();
refreshCartCount();


