/**
 * RetailOS - Vendeuse Dashboard & POS Logic
 */

const VendeuseApp = {
    currentUser: null,

    init() {
        if (!Auth.requireRole('vendeuse')) return;

        this.currentUser = StorageHelper.getCurrentUser();
        if (this.currentUser) {
            document.getElementById('user-name').textContent = this.currentUser.name;
            const avatar = this.currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(this.currentUser.name)}&background=random`;
            document.getElementById('user-avatar').src = avatar;

            // Dashboard Welcome
            const dashName = document.getElementById('dash-name');
            if (dashName) dashName.textContent = this.currentUser.name;
        }

        // Set Date
        const dateEl = document.getElementById('current-date');
        if (dateEl) {
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            dateEl.textContent = new Date().toLocaleDateString('fr-FR', options);
        }

        // Load specific view data
        this.loadDashboardData();

        // Init POS
        POS.init();
    },

    switchView(viewId) {
        // Nav State
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('bg-primary/10', 'text-primary');
            el.classList.add('text-gray-500', 'hover:bg-gray-50'); // Reset style

            if (el.id === `nav-${viewId}`) {
                el.classList.add('bg-primary/10', 'text-primary');
                el.classList.remove('text-gray-500', 'hover:bg-gray-50');
            }
        });

        // Hide all views
        ['dashboard', 'pos', 'history', 'clients'].forEach(v => {
            const el = document.getElementById(`view-${v}`);
            if (el) {
                el.classList.add('hidden');
                // Special handling for pos layout
                if (v === 'pos') el.classList.remove('flex');
            }
        });

        // Show selected view
        const target = document.getElementById(`view-${viewId}`);
        if (target) {
            target.classList.remove('hidden');
            if (viewId === 'pos') {
                target.classList.add('flex'); // POS uses flex layout
            } else {
                target.classList.add('animate-fade-in'); // Others use animation
            }
        }

        // Update Title
        const titles = {
            dashboard: "Bonjour !",
            pos: "Caisse & Vente",
            history: "Historique des Ventes",
            clients: "Mes Clientes"
        };
        const subtext = {
            dashboard: "Prêt pour une excellente journée de vente ?",
            pos: "Ajoutez des produits au panier pour commencer.",
            history: "Consultez vos performances passées.",
            clients: "Gérez votre carnet d'adresses."
        };

        const titleEl = document.getElementById('view-title');
        const subEl = document.getElementById('view-subtitle');
        if (titleEl) titleEl.textContent = titles[viewId];
        if (subEl) subEl.textContent = subtext[viewId];

        // Specific Loads
        if (viewId === 'history') this.loadHistory();
    },

    formatCurrency(amount) {
        // Read settings if available, else default to XAF
        const settings = Storage.get('settings');
        const currency = settings ? settings.currency : 'XAF';
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency }).format(amount);
    },

    async loadDashboardData() {
        if (!this.currentUser) return;

        // Calc Stats Today
        const sales = await StorageHelper.getSalesByVendeuse(this.currentUser.id);
        const today = new Date().toDateString();

        const salesToday = sales.filter(s => new Date(s.date).toDateString() === today);
        const totalToday = salesToday.reduce((sum, s) => sum + s.total, 0);
        const avgCart = sales.length > 0 ? (sales.reduce((sum, s) => sum + s.total, 0) / sales.length) : 0;

        // UI Updates
        const elToday = document.getElementById('dash-sales-today');
        const elCount = document.getElementById('dash-trans-count');
        const elAvg = document.getElementById('dash-avg-cart');

        if (elToday) elToday.textContent = this.formatCurrency(totalToday);
        if (elCount) elCount.textContent = salesToday.length;
        if (elAvg) elAvg.textContent = this.formatCurrency(avgCart);

        // Recent Activity
        const activityContainer = document.getElementById('dash-recent-activity');
        if (activityContainer) {
            activityContainer.innerHTML = '';
            const recent = sales.slice(-5).reverse();

            if (recent.length === 0) {
                activityContainer.innerHTML = '<div class="p-4 text-center text-gray-400">Aucune vente récente</div>';
            } else {
                recent.forEach(sale => {
                    const div = document.createElement('div');
                    div.className = 'p-5 hover:bg-gray-50 transition-colors flex items-center justify-between';
                    div.innerHTML = `
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 rounded-full bg-blue-50 text-primary flex items-center justify-center">
                                <span class="material-symbols-outlined">shopping_bag</span>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-gray-900 line-clamp-1">#${sale.id.slice(-6)} • ${sale.clienteName || sale.clientName || 'Invité'}</p>
                                <p class="text-xs text-gray-500">${new Date(sale.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} • ${sale.items.length} articles</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-gray-900">${this.formatCurrency(sale.total)}</p>
                            <span class="text-[10px] uppercase font-bold text-gray-400 tracking-wider">${sale.paymentMethod}</span>
                        </div>
                    `;
                    activityContainer.appendChild(div);
                });
            }
        }
    },

    async loadHistory() {
        if (!this.currentUser) return;
        const sales = await StorageHelper.getSalesByVendeuse(this.currentUser.id);
        const tbody = document.getElementById('history-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';
        sales.slice().reverse().forEach(sale => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';
            tr.innerHTML = `
                <td class="p-4 font-mono text-gray-600 text-xs">${sale.id}</td>
                <td class="p-4">${new Date(sale.date).toLocaleString('fr-FR')}</td>
                <td class="p-4 font-medium text-gray-900">${sale.clienteName || sale.clientName || 'Passage'}</td>
                <td class="p-4 text-right font-bold text-gray-900">${this.formatCurrency(sale.total)}</td>
                <td class="p-4 text-center">
                    <span class="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 uppercase">Complété</span>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
};

const POS = {
    cart: [],
    products: [],
    currentClient: null,
    paymentMethod: 'cash',

    init() {
        this.products = StorageHelper.getProducts();
        this.renderProducts();

        // Search listener
        const searchInput = document.getElementById('pos-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const filtered = this.products.filter(p => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term));
                this.renderProducts(null, filtered);
            });
        }
    },

    renderProducts(category = null, list = null) {
        const grid = document.getElementById('pos-products-grid');
        if (!grid) return;
        grid.innerHTML = '';

        let items = list || this.products;
        if (category && category !== 'Tout') {
            items = items.filter(p => p.category === category);
        }

        items.forEach(product => {
            const div = document.createElement('div');
            // Check stock logic
            const isLowStock = product.stock > 0 && product.stock <= 5;
            const isOut = product.stock === 0;

            div.className = `bg-white rounded-xl border border-gray-100 shadow-sm p-3 group hover:shadow-md transition-all cursor-pointer relative ${isOut ? 'opacity-50 grayscale pointer-events-none' : ''}`;
            div.onclick = () => this.addToCart(product);

            // Format price using VendeuseApp helper if possible, or new Intl
            const priceFormatted = VendeuseApp.formatCurrency(product.price);

            div.innerHTML = `
                <div class="aspect-square rounded-lg bg-gray-50 mb-3 overflow-hidden">
                    <img src="${product.image}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                </div>
                <div class="mb-2">
                    <h4 class="font-bold text-sm text-gray-800 line-clamp-1">${product.name}</h4>
                    <p class="text-xs text-gray-500">${product.sku}</p>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-primary font-bold">${priceFormatted}</span>
                    ${product.stock > 0
                    ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${isLowStock ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}">${product.stock} stock</span>`
                    : `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">Rupture</span>`
                }
                </div>
                <!-- Hover Add Icon -->
                <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-white rounded-full p-2 shadow-lg z-10">
                    <span class="material-symbols-outlined">add</span>
                </div>
            `;
            grid.appendChild(div);
        });
    },

    addToCart(product) {
        const existing = this.cart.find(item => item.id === product.id);

        if (existing) {
            if (existing.quantity < product.stock) {
                existing.quantity++;
            } else {
                alert('Stock insuffisant !');
                return;
            }
        } else {
            this.cart.push({ ...product, quantity: 1 });
        }

        this.renderCart();
    },

    removeFromCart(index) {
        this.cart.splice(index, 1);
        this.renderCart();
    },

    updateQuantity(index, delta) {
        const item = this.cart[index];
        const newQty = item.quantity + delta;

        if (newQty <= 0) {
            this.removeFromCart(index);
        } else if (newQty > item.stock) {
            alert('Stock maximum atteint');
        } else {
            item.quantity = newQty;
            this.renderCart();
        }
    },

    clearCart() {
        if (confirm("Vider le panier ?")) {
            this.cart = [];
            this.renderCart();
        }
    },

    setPaymentMethod(method) {
        this.paymentMethod = method;
        // Visual
        ['cash', 'card', 'mobile'].forEach(m => {
            const btn = document.getElementById(`pm-${m}`);
            if (m === method) {
                btn.className = "py-2 rounded-lg border border-primary bg-primary/5 text-primary text-sm font-bold transition-all flex flex-col items-center gap-1 ring-1 ring-primary";
            } else {
                btn.className = "py-2 rounded-lg border border-gray-200 hover:border-primary hover:bg-blue-50 text-sm font-medium transition-all flex flex-col items-center gap-1";
            }
        });
    },

    renderCart() {
        const container = document.getElementById('pos-cart-items');
        if (!container) return;

        container.innerHTML = '';

        if (this.cart.length === 0) {
            container.innerHTML = `
                <div class="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                    <span class="material-symbols-outlined text-6xl mb-4">shopping_cart_off</span>
                    <p>Le panier est vide</p>
                </div>`;
        } else {
            this.cart.forEach((item, index) => {
                const row = document.createElement('div');
                row.className = 'flex items-center gap-3 animate-slide-in-right';
                row.innerHTML = `
                    <img src="${item.image}" class="w-12 h-12 rounded-lg object-cover border border-gray-200">
                    <div class="flex-1 min-w-0">
                        <h5 class="text-sm font-bold text-gray-900 line-clamp-1">${item.name}</h5>
                        <p class="text-xs text-gray-500">${VendeuseApp.formatCurrency(item.price)} / unit</p>
                    </div>
                    <div class="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                        <button onclick="POS.updateQuantity(${index}, -1)" class="w-6 h-6 flex items-center justify-center rounded bg-white shadow-sm hover:text-red-500 text-gray-600">-</button>
                        <span class="text-sm font-bold w-4 text-center">${item.quantity}</span>
                        <button onclick="POS.updateQuantity(${index}, 1)" class="w-6 h-6 flex items-center justify-center rounded bg-white shadow-sm hover:text-green-500 text-gray-600">+</button>
                    </div>
                    <div class="text-right min-w-[60px]">
                        <div class="text-sm font-bold text-gray-900">${VendeuseApp.formatCurrency(item.price * item.quantity)}</div>
                    </div>
                `;
                container.appendChild(row);
            });
        }

        this.updateTotals();
    },

    updateTotals() {
        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        // Using XAF rules (usually inclusive or added? User requests XAF. Let's stick to simple sum for now but display tax line).
        const taxRate = 0.08;
        const tax = subtotal * taxRate;
        const total = subtotal + tax;

        document.getElementById('cart-subtotal').textContent = VendeuseApp.formatCurrency(subtotal);
        document.getElementById('cart-tax').textContent = VendeuseApp.formatCurrency(tax);
        document.getElementById('cart-total').textContent = VendeuseApp.formatCurrency(total);
    },

    openClientModal() {
        document.getElementById('client-modal').classList.remove('hidden');
    },

    selectClient(client) {
        this.currentClient = client;
        document.getElementById('client-modal').classList.add('hidden');

        // Update Cart Header
        const container = document.getElementById('client-selector');
        container.innerHTML = `
            <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span class="material-symbols-outlined">person</span>
            </div>
            <div class="flex-1">
                <p class="text-sm font-bold text-primary">${client.name}</p>
                <p class="text-xs text-gray-500">${client.type || 'Client'}</p>
            </div>
            <button class="p-2 hover:bg-gray-200 rounded-full transition-colors text-red-400" onclick="POS.selectClient({name:'Client invité', id:null})">
                <span class="material-symbols-outlined">close</span>
            </button>
        `;
    },

    async processSale() {
        if (this.cart.length === 0) {
            alert('Le panier est vide.');
            return;
        }

        const btn = document.querySelector('button[onclick="POS.processSale()"]');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined animate-spin">refresh</span> TRAITEMENT...';

        // Prepare data
        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * 0.08;
        const total = subtotal + tax;

        const saleData = {
            id: 'SALE_' + Date.now(),
            date: new Date().toISOString(),
            vendeuseId: VendeuseApp.currentUser.id,
            vendeuseName: VendeuseApp.currentUser.name,
            clienteId: this.currentClient ? this.currentClient.id : null,
            clienteName: this.currentClient ? this.currentClient.name : 'Client invité',
            clientName: this.currentClient ? this.currentClient.name : 'Client invité', // Duplicate for compatibility
            items: this.cart.map(i => ({
                id: i.id,
                name: i.name,
                quantity: i.quantity,
                price: i.price,
                total: i.price * i.quantity
            })),
            subtotal,
            tax,
            discount: 0,
            total,
            paymentMethod: this.paymentMethod,
            status: 'completed'
        };

        // Save
        const success = await StorageHelper.addSale(saleData);

        if (success) {
            // Simulate processing time
            setTimeout(() => {
                alert(`Vente enregistrée avec succès !\nMontant: ${VendeuseApp.formatCurrency(total)}`);
                this.cart = [];
                this.renderCart();
                this.currentClient = null;
                // Reset Client Selector
                const clientSelector = document.getElementById('client-selector');
                if (clientSelector) {
                    clientSelector.innerHTML = `
                             <div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                                 <span class="material-symbols-outlined">person</span>
                             </div>
                             <div class="flex-1">
                                 <button onclick="POS.openClientModal()" class="text-sm font-medium text-primary hover:underline flex items-center">
                                     Sélectionner Client <span class="material-symbols-outlined text-sm ml-1">arrow_drop_down</span>
                                 </button>
                                 <p class="text-xs text-gray-400">Client invité</p>
                             </div>
                             <button class="p-2 hover:bg-gray-200 rounded-full transition-colors" onclick="POS.openClientModal()">
                                 <span class="material-symbols-outlined text-gray-500">person_add</span>
                             </button>
                    `;
                }

                btn.disabled = false;
                btn.innerHTML = originalText;

                // Refresh dashboard view
                VendeuseApp.loadDashboardData();

            }, 1000);
        } else {
            alert('Erreur lors de l\'enregistrement');
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
};

// Start
window.addEventListener('load', () => {
    VendeuseApp.init();
});
