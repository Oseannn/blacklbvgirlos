/**
 * RetailOS - Manager Logic
 * Handles Dashboard, Product Management (CRUD + Variants)
 */

const ManagerApp = {
    currentUser: null,
    currentView: 'dashboard',
    settings: {},

    init() {
        // Check Auth
        this.currentUser = Auth.checkSession();
        if (!this.currentUser || this.currentUser.role !== 'manager') {
            // Optional: Strict redirect if Auth.js didn't catch it
            // window.location.href = 'index.html'; 
        }

        // Load Settings
        const settings = localStorage.getItem('retailos_settings');
        if (settings) this.settings = JSON.parse(settings);

        // Sidebar
        this.updateUserInterface();

        // Default View
        this.switchView('dashboard');

        console.log("ManagerApp Initialized");
    },

    updateUserInterface() {
        if (!this.currentUser) return;
        // Could update Avatar/Name in sidebar here
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: this.settings.currency || 'XAF' }).format(amount);
    },

    switchView(viewId) {
        // Update Nav
        document.querySelectorAll('nav button').forEach(el => {
            el.classList.remove('bg-primary/10', 'text-primary');
            el.classList.add('text-gray-500', 'hover:bg-gray-50');
            if (el.id === `nav-${viewId}`) {
                el.classList.add('bg-primary/10', 'text-primary');
                el.classList.remove('text-gray-500', 'hover:bg-gray-50');
            }
        });

        // Hide Views
        ['dashboard', 'products', 'settings', 'sales'].forEach(v => {
            const el = document.getElementById(`view-${v}`);
            if (el) el.classList.add('hidden');
        });

        // Show View
        const target = document.getElementById(`view-${viewId}`);
        if (target) target.classList.remove('hidden');

        // Update Title
        const names = {
            dashboard: "Vue d'ensemble",
            products: "Gestion Produits",
            sales: "Ventes par Vendeuse"
        };
        document.getElementById('page-title').textContent = names[viewId] || 'Manager';

        this.currentView = viewId;

        // Load Data
        if (viewId === 'dashboard') this.loadDashboardData();
        if (viewId === 'products') this.loadProducts();
        if (viewId === 'sales') this.loadSalesView();
    },

    // --- SALES VIEW ---
    renderSellerAnalysis(allSales, selectedId) {
        const container = document.getElementById('sales-analysis-container');
        if (!container) return;
        container.innerHTML = '';

        if (!selectedId) {
            this.renderGlobalSellerStats(container, allSales);
        } else {
            this.renderDetailedSellerStats(container, allSales, selectedId);
        }
    },

    renderGlobalSellerStats(container, allSales) {
        const stats = {};

        allSales.forEach(s => {
            if (!s.vendeuseId) return;
            if (!stats[s.vendeuseId]) {
                stats[s.vendeuseId] = { name: s.vendeuseName, count: 0, total: 0 };
            }
            if (!stats[s.vendeuseId].name && s.vendeuseName) stats[s.vendeuseId].name = s.vendeuseName;

            stats[s.vendeuseId].count++;
            stats[s.vendeuseId].total += s.total;
        });

        const users = StorageHelper.getUsers();
        Object.values(users).forEach(u => {
            if (u.role === 'vendeuse' && !stats[u.id]) {
                stats[u.id] = { name: u.name, count: 0, total: 0 };
            } else if (u.role === 'vendeuse' && !stats[u.id].name) {
                stats[u.id].name = u.name;
            }
        });

        const sortedStats = Object.values(stats).sort((a, b) => b.total - a.total);

        container.innerHTML = `
            <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 class="font-bold text-gray-900 mb-4">Performance Vendeuses (Global)</h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-gray-50 text-gray-500 uppercase">
                            <tr>
                                <th class="px-4 py-3">Vendeuse</th>
                                <th class="px-4 py-3 text-center">Ventes #</th>
                                <th class="px-4 py-3 text-right">CA Total</th>
                                <th class="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            ${sortedStats.map(s => `
                                <tr class="hover:bg-gray-50">
                                    <td class="px-4 py-3 font-medium text-gray-900">${s.name || 'Inconnu'}</td>
                                    <td class="px-4 py-3 text-center">${s.count}</td>
                                    <td class="px-4 py-3 text-right font-bold">${this.formatCurrency(s.total)}</td>
                                    <td class="px-4 py-3 text-right">
                                        <button onclick="document.getElementById('sales-vendeuse-filter').value = '${Object.keys(stats).find(key => stats[key] === s)}'; ManagerApp.loadSalesView();" 
                                        class="text-primary hover:text-blue-700 text-xs font-medium">
                                            Voir Détails
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    renderDetailedSellerStats(container, allSales, selectedId) {
        const sales = allSales.filter(s => s.vendeuseId === selectedId);
        const itemStats = {};

        sales.forEach(s => {
            if (s.items) {
                s.items.forEach(i => {
                    const key = i.name;
                    if (!itemStats[key]) itemStats[key] = { name: i.name, qty: 0, total: 0 };
                    itemStats[key].qty += i.quantity;
                    itemStats[key].total += (i.price * i.quantity);
                });
            }
        });

        const topItems = Object.values(itemStats).sort((a, b) => b.qty - a.qty);

        container.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Top Items Sold -->
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 class="font-bold text-gray-900 mb-4">Articles Vendus</h3>
                    <div class="overflow-y-auto max-h-64">
                         <table class="w-full text-left text-sm">
                            <thead class="bg-gray-50 text-gray-500 sticky top-0">
                                <tr>
                                    <th class="px-4 py-2">Article</th>
                                    <th class="px-4 py-2 text-center">Qté</th>
                                    <th class="px-4 py-2 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100">
                                ${topItems.length > 0 ? topItems.map(i => `
                                    <tr>
                                        <td class="px-4 py-2 text-gray-600 truncate max-w-[150px]">${i.name}</td>
                                        <td class="px-4 py-2 text-center font-medium">${i.qty}</td>
                                        <td class="px-4 py-2 text-right">${this.formatCurrency(i.total)}</td>
                                    </tr>
                                `).join('') : '<tr><td colspan="3" class="px-4 py-4 text-center text-gray-400">Aucun article vendu.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Info Card -->
                 <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
                    <span class="material-symbols-outlined text-4xl text-blue-100 mb-3 block">insights</span>
                    <h3 class="font-bold text-gray-900">Performance</h3>
                    <p class="text-sm text-gray-500 mt-2">
                        Cette vendeuse a réalisé <span class="font-bold text-gray-900">${sales.length}</span> ventes 
                        pour un total de <span class="font-bold text-primary">${this.formatCurrency(sales.reduce((a, b) => a + b.total, 0))}</span>.
                    </p>
                    <div class="mt-6 w-full bg-gray-50 rounded-lg p-4 text-left">
                        <p class="text-xs text-gray-400 uppercase font-semibold">Article le plus vendu</p>
                        <p class="text-sm font-medium text-gray-900 mt-1">
                            ${topItems.length > 0 ? `${topItems[0].name} (${topItems[0].qty})` : '-'}
                        </p>
                    </div>
                </div>
            </div>
        `;
    },

    renderSalesHistoryTable(filteredSales) {
        const tbody = document.getElementById('sales-table-body');
        const sortedSales = filteredSales.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (sortedSales.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-gray-400">Aucune vente trouvée.</td></tr>`;
            return;
        }

        tbody.innerHTML = sortedSales.map(s => {
            const date = new Date(s.date);
            const dateStr = date.toLocaleDateString('fr-FR');
            const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

            const itemsCount = s.items ? s.items.reduce((c, i) => c + i.quantity, 0) : 0;
            const vendeuseName = s.vendeuseName || 'N/A';

            let vName = vendeuseName;
            if (vName === 'N/A' && s.vendeuseId) {
                const u = StorageHelper.getUsers();
                const found = Object.values(u).find(user => user.id === s.vendeuseId);
                if (found) vName = found.name;
            }

            const itemsHtml = s.items ? s.items.map(i => `
                <div class="flex justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                    <span class="text-gray-600">${i.quantity}x ${i.name}</span>
                    <span class="font-medium text-gray-900">${this.formatCurrency(i.price * i.quantity)}</span>
                </div>
            `).join('') : '';

            return `
                <tr class="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                    <td class="px-6 py-4">
                        <div class="text-sm font-medium text-gray-900">${dateStr}</div>
                        <div class="text-xs text-gray-500">${timeStr}</div>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-600">
                        <div class="flex items-center gap-2">
                            <span class="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">
                                ${vName.charAt(0)}
                            </span>
                            ${vName}
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">${s.clienteName || s.clientName || 'Inconnu'}</td>
                    <td class="px-6 py-4">
                         <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                            ${s.paymentMethod || s.method || 'Espèces'}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-center text-sm text-gray-500">${itemsCount}</td>
                    <td class="px-6 py-4 text-right font-bold text-gray-900">${this.formatCurrency(s.total)}</td>
                    <td class="px-6 py-4 text-right">
                        <button onclick="ManagerApp.toggleSaleDetails(this)" class="text-primary hover:bg-blue-50 p-1 rounded transition-colors">
                            <span class="material-symbols-outlined text-lg">expand_more</span>
                        </button>
                    </td>
                </tr>
                <tr class="hidden bg-gray-50/50">
                    <td colspan="7" class="px-6 py-2">
                        <div class="bg-white rounded-lg border border-gray-100 p-3 max-w-lg ml-auto shadow-sm">
                            <h5 class="text-xs font-bold text-gray-900 mb-2 uppercase tracking-wide">Détails de la commande</h5>
                            ${itemsHtml}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    async loadSalesView() {
        // 1. Init Filter
        const filterSelect = document.getElementById('sales-vendeuse-filter');
        if (filterSelect && filterSelect.options.length <= 1) {
            const users = StorageHelper.getUsers();
            Object.values(users).forEach(u => {
                if (u.role === 'vendeuse') {
                    const opt = document.createElement('option');
                    opt.value = u.id;
                    opt.textContent = u.name;
                    filterSelect.appendChild(opt);
                }
            });
        }

        const selectedVendeuseId = filterSelect ? filterSelect.value : '';
        const allSales = await StorageHelper.getSales();

        // 2. Filter & KPIs
        const filteredSales = selectedVendeuseId
            ? allSales.filter(s => s.vendeuseId === selectedVendeuseId)
            : allSales;

        const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
        const count = filteredSales.length;
        const avgCart = count > 0 ? totalRevenue / count : 0;

        const elTotal = document.getElementById('sales-total-display');
        const elCount = document.getElementById('sales-count-display');
        const elAvg = document.getElementById('sales-avg-display');

        if (elTotal) elTotal.textContent = this.formatCurrency(totalRevenue);
        if (elCount) elCount.textContent = count;
        if (elAvg) elAvg.textContent = this.formatCurrency(avgCart);

        // 3. Render Analysis (Global or Specific)
        this.renderSellerAnalysis(allSales, selectedVendeuseId);

        // 4. Render History Table
        this.renderSalesHistoryTable(filteredSales);
    },

    async loadSalesView_OLD() {
        // 1. Populate Filter (if empty)
        const filterSelect = document.getElementById('sales-vendeuse-filter');
        if (filterSelect && filterSelect.options.length <= 1) {
            const users = StorageHelper.getUsers();
            Object.values(users).forEach(u => {
                if (u.role === 'vendeuse') {
                    const opt = document.createElement('option');
                    opt.value = u.id;
                    opt.textContent = u.name;
                    filterSelect.appendChild(opt);
                }
            });
        }

        const selectedVendeuseId = filterSelect ? filterSelect.value : '';
        const allSales = await StorageHelper.getSales();

        // Filter by Vendeuse
        const filteredSales = selectedVendeuseId
            ? allSales.filter(s => s.vendeuseId === selectedVendeuseId)
            : allSales;

        // Calculate KPIs
        const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
        const count = filteredSales.length;
        const avgCart = count > 0 ? totalRevenue / count : 0;

        // Update Summary Cards
        const elTotal = document.getElementById('sales-total-display');
        const elCount = document.getElementById('sales-count-display');
        const elAvg = document.getElementById('sales-avg-display');

        if (elTotal) elTotal.textContent = this.formatCurrency(totalRevenue);
        if (elCount) elCount.textContent = count;
        if (elAvg) elAvg.textContent = this.formatCurrency(avgCart);

        // Render Table
        const tbody = document.getElementById('sales-table-body');
        const sortedSales = filteredSales.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (sortedSales.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-gray-400">Aucune vente trouvée.</td></tr>`;
            return;
        }

        tbody.innerHTML = sortedSales.map(s => {
            const date = new Date(s.date);
            const dateStr = date.toLocaleDateString('fr-FR');
            const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

            const itemsCount = s.items ? s.items.reduce((c, i) => c + i.quantity, 0) : 0;
            const vendeuseName = s.vendeuseName || 'N/A';

            // Resolve Vendeuse Name if missing
            let vName = vendeuseName;
            if (vName === 'N/A' && s.vendeuseId) {
                const u = StorageHelper.getUsers();
                const found = Object.values(u).find(user => user.id === s.vendeuseId);
                if (found) vName = found.name;
            }

            // Items Details HTML
            const itemsHtml = s.items ? s.items.map(i => `
                <div class="flex justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                    <span class="text-gray-600">${i.quantity}x ${i.name}</span>
                    <span class="font-medium text-gray-900">${this.formatCurrency(i.price * i.quantity)}</span>
                </div>
            `).join('') : '';

            return `
                <tr class="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                    <td class="px-6 py-4">
                        <div class="text-sm font-medium text-gray-900">${dateStr}</div>
                        <div class="text-xs text-gray-500">${timeStr}</div>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-600">
                        <div class="flex items-center gap-2">
                            <span class="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">
                                ${vName.charAt(0)}
                            </span>
                            ${vName}
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">${s.clienteName || s.clientName || 'Inconnu'}</td>
                    <td class="px-6 py-4">
                         <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                            ${s.paymentMethod || s.method || 'Espèces'}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-center text-sm text-gray-500">${itemsCount}</td>
                    <td class="px-6 py-4 text-right font-bold text-gray-900">${this.formatCurrency(s.total)}</td>
                    <td class="px-6 py-4 text-right">
                        <button onclick="ManagerApp.toggleSaleDetails(this)" class="text-primary hover:bg-blue-50 p-1 rounded transition-colors">
                            <span class="material-symbols-outlined text-lg">expand_more</span>
                        </button>
                    </td>
                </tr>
                <tr class="hidden bg-gray-50/50">
                    <td colspan="7" class="px-6 py-2">
                        <div class="bg-white rounded-lg border border-gray-100 p-3 max-w-lg ml-auto shadow-sm">
                            <h5 class="text-xs font-bold text-gray-900 mb-2 uppercase tracking-wide">Détails de la commande</h5>
                            ${itemsHtml}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    toggleSaleDetails(btn) {
        const tr = btn.closest('tr');
        const nextTr = tr.nextElementSibling;
        if (nextTr) {
            nextTr.classList.toggle('hidden');
            const icon = btn.querySelector('span');
            if (icon) icon.textContent = nextTr.classList.contains('hidden') ? 'expand_more' : 'expand_less';
        }
    },

    exportReport(period) {
        StorageHelper.getSales().then(allSales => {
            const filterSelect = document.getElementById('sales-vendeuse-filter');
            const selectedVendeuseId = filterSelect ? filterSelect.value : '';

            let sales = this.filterSalesByPeriod(allSales, period);

            if (selectedVendeuseId) {
                sales = sales.filter(s => s.vendeuseId === selectedVendeuseId);
            }

            if (sales.length === 0) {
                alert("Aucune vente à exporter pour cette période.");
                return;
            }

            // CSV Generation
            const headers = ["ID", "Date", "Heure", "Vendeuse", "Client", "Articles", "Méthode", "Total"];
            const rows = sales.map(s => {
                const itemSummary = s.items ? s.items.map(i => `${i.quantity}x ${i.name}`).join('; ') : '';
                return [
                    s.id,
                    new Date(s.date).toLocaleDateString('fr-FR'),
                    new Date(s.date).toLocaleTimeString('fr-FR'),
                    s.vendeuseName || 'N/A',
                    s.clienteName || s.clientName || 'Inconnu',
                    `"${itemSummary.replace(/"/g, '""')}"`,
                    s.paymentMethod || s.method || 'cash',
                    s.total
                ].join(',');
            });

            const csvContent = "\uFEFF" + headers.join(',') + "\n" + rows.join('\n');
            const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `rapport_ventes_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        });
    },

    filterSalesByPeriod(sales, period) {
        const now = new Date();
        const today = new Date(now);
        return sales.filter(s => {
            const d = new Date(s.date);
            if (period === 'day') {
                return d.toDateString() === today.toDateString();
            } else if (period === 'week') {
                const day = today.getDay();
                const diff = today.getDate() - day + (day == 0 ? -6 : 1);
                const startOfWeek = new Date(today);
                startOfWeek.setDate(diff);
                startOfWeek.setHours(0, 0, 0, 0);
                return d >= startOfWeek;
            } else if (period === 'month') {
                return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
            }
            return true;
        });
    },

    // --- DASHBOARD ---
    async loadDashboardData() {
        const sales = await StorageHelper.getSales();
        const products = StorageHelper.getProducts();

        // Sales Today
        const today = new Date().toDateString();
        const salesToday = sales.filter(s => new Date(s.date).toDateString() === today);
        const totalToday = salesToday.reduce((sum, s) => sum + s.total, 0);

        // Stock Counts
        const totalStock = products.reduce((sum, p) => {
            if (p.variants && p.variants.length > 0) {
                return sum + p.variants.reduce((vSum, v) => vSum + (v.stock || 0), 0);
            }
            return sum + (p.stock || 0);
        }, 0);

        const lowStock = products.filter(p => {
            if (p.variants && p.variants.length > 0) {
                return p.variants.some(v => v.stock < 5);
            }
            return p.stock < 5;
        }).length;

        // Update UI
        document.getElementById('kpi-sales-today').textContent = this.formatCurrency(totalToday);
        document.getElementById('kpi-stock-count').textContent = totalStock;
        document.getElementById('kpi-low-stock').textContent = lowStock;

        // Top Products
        const productStats = {};
        sales.forEach(sale => {
            if (sale.items) {
                sale.items.forEach(item => {
                    const id = item.originalId || item.id; // handle variant ID vs product ID if needed
                    // Actually usually item.id is product ID for simple products, or variant ID for variants.
                    // For top products aggregation, we might want to group by Product Name if IDs differ for variants
                    // But here let's stick to simple grouping by ID for now.

                    if (!productStats[id]) productStats[id] = { name: item.name, qty: 0, total: 0 };
                    productStats[id].qty += item.quantity;
                    productStats[id].total += item.total;
                });
            }
        });

        const sortedProducts = Object.values(productStats).sort((a, b) => b.qty - a.qty).slice(0, 5);
        const tbody = document.getElementById('top-products-list');
        tbody.innerHTML = sortedProducts.map(p => `
            <tr>
                <td class="px-6 py-4 font-medium text-gray-900">${p.name}</td>
                <td class="px-6 py-4 text-center bg-gray-50 rounded-lg">${p.qty}</td>
                <td class="px-6 py-4 text-right font-bold text-gray-900">${this.formatCurrency(p.total)}</td>
            </tr>
        `).join('');
    },

    // --- PRODUCTS ---
    loadProducts() {
        const products = StorageHelper.getProducts();
        const tbody = document.getElementById('products-table');
        if (!tbody) return;

        tbody.innerHTML = '';
        products.forEach(p => {
            // Calculate total stock
            let stockDisplay = p.stock || 0;
            let variantsInfo = '';

            if (p.variants && p.variants.length > 0) {
                const totalVariantStock = p.variants.reduce((acc, v) => acc + (v.stock || 0), 0);
                stockDisplay = `<span class="font-bold">${totalVariantStock}</span> <span class="text-xs text-gray-400">(${p.variants.length} var.)</span>`;
                // Tooltip or subtitle
                variantsInfo = `<div class="text-xs text-gray-400 mt-1 truncate max-w-[150px]">${p.variants.map(v => `${v.size}/${v.color}`).join(', ')}</div>`;
            }

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 transition-colors group';
            tr.innerHTML = `
                <td class="px-6 py-4">
                    <div class="flex items-center">
                        <div class="h-10 w-10 flex-shrink-0">
                            ${p.image
                    ? `<img class="h-10 w-10 rounded-lg object-cover" src="${p.image}" alt="">`
                    : `<div class="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400"><span class="material-symbols-outlined">image</span></div>`
                }
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${p.name}</div>
                            ${variantsInfo}
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">${p.category}</td>
                <td class="px-6 py-4 text-sm font-medium text-gray-900">${this.formatCurrency(p.price)}</td>
                <td class="px-6 py-4 text-center text-sm text-gray-500">${stockDisplay}</td>
                <td class="px-6 py-4 text-center">
                     <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.active !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${p.active !== false ? 'Actif' : 'Inactif'}
                     </span>
                </td>
                <td class="px-6 py-4 text-right text-sm font-medium space-x-2">
                    <button onclick="ManagerApp.openProductModal('${p.id}')" class="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-1.5 rounded-lg transition-colors">
                        <span class="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button onclick="ManagerApp.deleteProduct('${p.id}')" class="text-red-600 hover:text-red-900 bg-red-50 p-1.5 rounded-lg transition-colors">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    filterProducts() {
        const term = document.getElementById('product-search').value.toLowerCase();
        const rows = document.querySelectorAll('#products-table tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    },

    // --- CRUD ---
    openProductModal(prodId = null) {
        const modal = document.getElementById('product-modal');
        const title = document.getElementById('modal-title');

        // Reset Form
        document.getElementById('prod-id').value = '';
        document.getElementById('prod-name').value = '';
        document.getElementById('prod-category').value = '';
        document.getElementById('prod-brand').value = '';
        document.getElementById('prod-price').value = '';
        // Reset Image
        document.getElementById('prod-image-file').value = '';
        document.getElementById('prod-image-base64').value = '';

        document.getElementById('variants-container').innerHTML = '';

        // Add Listener for Image File if not already added (simple check)
        const fileInput = document.getElementById('prod-image-file');
        if (fileInput && !fileInput.hasAttribute('data-listener')) {
            fileInput.setAttribute('data-listener', 'true');
            fileInput.addEventListener('change', function (e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onloadend = function () {
                        document.getElementById('prod-image-base64').value = reader.result;
                    }
                    reader.readAsDataURL(file);
                }
            });
        }

        if (prodId) {
            // Edit Mode
            const product = StorageHelper.getProducts().find(p => p.id === prodId);
            if (!product) return;

            title.textContent = 'Modifier Produit';
            document.getElementById('prod-id').value = product.id;
            document.getElementById('prod-name').value = product.name;
            document.getElementById('prod-category').value = product.category;
            document.getElementById('prod-brand').value = product.brand || '';
            document.getElementById('prod-price').value = product.price;

            // Set existing image to hidden base64 field if it exists
            if (product.image) {
                document.getElementById('prod-image-base64').value = product.image;
            }

            // Load Variants
            if (product.variants && product.variants.length > 0) {
                product.variants.forEach(v => this.addVariantRow(v));
            }
        } else {
            title.textContent = 'Nouveau Produit';
            this.addVariantRow(); // Add one empty row by default
        }

        modal.classList.remove('hidden');
    },

    addVariantRow(data = null) {
        const container = document.getElementById('variants-container');
        const index = container.children.length;
        const div = document.createElement('div');
        div.className = 'grid grid-cols-12 gap-2 items-center variant-row animate-fade-in bg-gray-50 p-2 rounded-lg border border-gray-100';

        div.innerHTML = `
            <div class="col-span-3">
                <input type="text" placeholder="Taille (S, M, 38...)" class="var-size w-full rounded border-gray-300 text-sm py-1" value="${data ? data.size : ''}" required>
            </div>
            <div class="col-span-4">
                <input type="text" placeholder="Couleur" class="var-color w-full rounded border-gray-300 text-sm py-1" value="${data ? data.color : ''}" required>
            </div>
            <div class="col-span-4">
                <input type="number" placeholder="Stock" class="var-stock w-full rounded border-gray-300 text-sm py-1" value="${data ? data.stock : 0}" min="0" required>
            </div>
            <div class="col-span-1 text-right">
                <button type="button" onclick="this.closest('.variant-row').remove()" class="text-red-400 hover:text-red-600">
                    <span class="material-symbols-outlined text-lg">close</span>
                </button>
            </div>
        `;
        container.appendChild(div);
    },

    saveProduct(e) {
        e.preventDefault();

        const id = document.getElementById('prod-id').value;
        const name = document.getElementById('prod-name').value;
        const category = document.getElementById('prod-category').value;
        const brand = document.getElementById('prod-brand').value;
        const price = parseFloat(document.getElementById('prod-price').value);
        // Get Image from Base64 hidden input
        const image = document.getElementById('prod-image-base64').value;

        // Collect Variants
        const variants = [];
        document.querySelectorAll('.variant-row').forEach((row, idx) => {
            const size = row.querySelector('.var-size').value;
            const color = row.querySelector('.var-color').value;
            const stock = parseInt(row.querySelector('.var-stock').value) || 0;
            if (size && color) {
                variants.push({
                    id: id ? (id + `_v${idx}_${Date.now()}`) : `VAR_${Date.now()}_${idx}`, // Simple ID gen
                    size,
                    color,
                    stock
                });
            }
        });

        const productData = {
            id: id || 'PROD_' + Date.now(),
            name,
            category,
            brand,
            price,
            image,
            active: true,
            variants,
            // Fallback stock for legacy display
            stock: variants.reduce((s, v) => s + v.stock, 0)
        };

        if (id) {
            StorageHelper.updateProduct(productData);
        } else {
            StorageHelper.addProduct(productData);
        }

        document.getElementById('product-modal').classList.add('hidden');
        this.loadProducts();
        // Refresh Current View
        if (this.currentView === 'dashboard') this.loadDashboardData();
        if (this.currentView === 'sales') this.loadSalesView();
    },

    deleteProduct(id) {
        if (confirm('Voulez-vous vraiment supprimer ce produit ?')) {
            StorageHelper.deleteProduct(id);
            this.loadProducts();
        }
    }
};
