/**
 * RetailOS - Admin Dashboard Logic
 */

const AdminApp = {
    currentView: 'dashboard',
    chartInstance: null,
    settings: {
        storeName: 'RetailOS Store',
        email: 'contact@retailos.com',
        currency: 'XAF', // Default to XAF (FCFA)
        taxRate: 20,
        darkMode: false
    },

    init() {
        // Auth Check
        if (!Auth.requireRole('admin')) return;

        // Load Settings First
        this.loadSettings();

        // Apply Settings (Title, etc)
        this.applyAppState();

        // Load Admin Profile
        const user = StorageHelper.getCurrentUser();
        if (user) {
            const adminNameEl = document.getElementById('admin-name');
            const adminAvatarEl = document.getElementById('admin-avatar');
            if (adminNameEl) adminNameEl.textContent = user.name;
            if (adminAvatarEl) adminAvatarEl.src = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=137fec&color=fff`;
        }

        // Initial Data Load
        this.loadDashboardData();
        this.loadUsers();

        // Chart Initialization
        this.initChart();

        // Global Access
        window.AdminApp = this;
    },

    // --- NAVIGATION ---
    switchView(viewId) {
        // Update Nav State
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('bg-primary/10', 'text-primary');
            el.classList.add('text-gray-500', 'hover:bg-gray-50');

            if (el.id === `nav-${viewId}`) {
                el.classList.add('bg-primary/10', 'text-primary');
                el.classList.remove('text-gray-500', 'hover:bg-gray-50');
            }
        });

        // Hide all views
        ['dashboard', 'users', 'reports', 'caisse', 'clients', 'settings'].forEach(v => {
            const el = document.getElementById(`view-${v}`);
            if (el) el.classList.add('hidden');
        });

        // Show selected view
        const target = document.getElementById(`view-${viewId}`);
        if (target) {
            target.classList.remove('hidden');
            target.classList.add('animate-fade-in');
        }

        // Update Header Title
        const titles = {
            dashboard: "Vue d'ensemble",
            users: "Gestion des Utilisateurs",
            reports: "Rapports & Statistiques",
            caisse: "Supervision Caisse",
            clients: "Top Clients",
            settings: "Paramètres"
        };
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = titles[viewId] || 'Dashboard';

        this.currentView = viewId;

        // Refresh Data on View Switch
        if (viewId === 'reports') {
            this.loadReports('month');
        } else if (viewId === 'caisse') {
            this.loadCaisseGlobalView();
        } else if (viewId === 'clients') {
            this.loadTopClients();
        } else if (viewId === 'settings') {
            this.fillSettingsForm();
        } else if (viewId === 'dashboard') {
            this.loadDashboardData();
        } else if (viewId === 'users') {
            this.loadUsers();
        }
    },

    // --- CURRENCY HELPER ---
    formatCurrency(amount) {
        const currency = this.settings.currency || 'XAF';
        // Handle XAF specifically via custom format or built-in
        const formatter = new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: currency
        });
        return formatter.format(amount);
    },

    // --- DASHBOARD DATA ---
    async loadDashboardData() {
        const sales = await StorageHelper.getSales();
        const users = StorageHelper.getUsers();

        // Calculate KPIs
        const totalRevenue = sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
        const totalSales = sales.length;

        // Find Top Seller
        const sellers = {};
        Object.values(users).forEach(u => {
            if (u.role === 'vendeuse') {
                sellers[u.id] = { name: u.name, total: 0, count: 0, avatar: u.avatar };
            }
        });

        sales.forEach(sale => {
            // Loose matching for ID safety (string/number)
            const id = Object.keys(sellers).find(k => k == sale.vendeuseId);
            if (id && sellers[id]) {
                sellers[id].total += sale.total;
                sellers[id].count += 1;
            }
        });

        const sortedSellers = Object.values(sellers).sort((a, b) => b.total - a.total);
        const topSeller = sortedSellers[0];

        // Find Top Client (Global)
        const clientStats = {};
        sales.forEach(s => {
            // Logic to capture client name even if clientId is null (guest)? No, only real clients for Top.
            if (s.clientId) {
                if (!clientStats[s.clientId]) clientStats[s.clientId] = { count: 0, total: 0, name: s.clientName };
                clientStats[s.clientId].count++;
                clientStats[s.clientId].total += s.total;
            }
        });
        const topClient = Object.values(clientStats).sort((a, b) => b.total - a.total)[0];

        // Update DOM Elements
        const elRevenue = document.getElementById('kpi-revenue');
        const elSales = document.getElementById('kpi-sales-count');
        const elSellerName = document.getElementById('kpi-top-seller');
        const elSellerAmt = document.getElementById('kpi-top-seller-amount');
        const elClientName = document.getElementById('kpi-top-client');
        const elClientOrders = document.getElementById('kpi-top-client-orders');

        if (elRevenue) elRevenue.textContent = this.formatCurrency(totalRevenue);
        if (elSales) elSales.textContent = totalSales;

        if (topSeller && elSellerName) {
            elSellerName.textContent = topSeller.name;
            elSellerAmt.textContent = this.formatCurrency(topSeller.total);
        } else if (elSellerName) {
            elSellerName.textContent = "-";
            elSellerAmt.textContent = "";
        }

        if (topClient && elClientName) {
            elClientName.textContent = topClient.name;
            elClientOrders.textContent = topClient.count + ' commandes';
        } else if (elClientName) {
            elClientName.textContent = "Aucun client";
            elClientOrders.textContent = "-";
        }

        // Update Performance Table
        this.renderSellersTable(sortedSellers, users);
    },

    renderSellersTable(sortedSellers, users) {
        const tableBody = document.getElementById('sellers-perf-table');
        if (!tableBody) return;
        tableBody.innerHTML = '';

        sortedSellers.forEach(seller => {
            const commission = seller.total * 0.05;
            // Find ID safely
            const sellerId = Object.keys(users).find(key => users[key].name === seller.name);

            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50/50 transition-colors';
            row.innerHTML = `
                <td class="px-6 py-4">
                    <div class="flex items-center">
                        <img class="h-8 w-8 rounded-full object-cover border border-gray-200" src="${seller.avatar}" alt="${seller.name}">
                        <div class="ml-3">
                            <div class="text-sm font-medium text-gray-900">${seller.name}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                    </span>
                </td>
                <td class="px-6 py-4 text-right text-gray-900 font-medium">
                    ${this.formatCurrency(seller.total)}
                </td>
                <td class="px-6 py-4 text-right text-gray-500">
                    ${this.formatCurrency(commission)}
                </td>
                <td class="px-6 py-4">
                    <div class="w-full bg-gray-200 rounded-full h-1.5">
                        <div class="bg-primary h-1.5 rounded-full" style="width: 45%"></div>
                    </div>
                    <span class="text-xs text-gray-400 mt-1 block">45% de l'objectif</span>
                </td>
                <td class="px-6 py-4 text-right">
                    <button type="button" onclick="AdminApp.viewSellerDetails('${sellerId}')" class="text-gray-400 hover:text-primary transition-colors cursor-pointer">
                        <span class="material-symbols-outlined text-lg">visibility</span>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    },

    // --- USERS MANAGEMENT ---

    saveUser(e) {
        e.preventDefault();

        const id = document.getElementById('user-id').value;
        const firstName = document.getElementById('user-firstname').value;
        const lastName = document.getElementById('user-lastname').value;
        const email = document.getElementById('user-email').value;
        const password = document.getElementById('user-password').value;
        const isActive = document.getElementById('user-active').checked;

        const users = StorageHelper.getUsers();

        if (!firstName || !lastName || !email) {
            alert("Veuillez remplir les champs obligatoires");
            return;
        }

        if (id && users[id]) {
            // Edit existing
            users[id].name = `${firstName} ${lastName}`;
            users[id].email = email;
            users[id].status = isActive ? 'active' : 'inactive';
            if (password) users[id].password = password;

            Storage.set('users', users);
            alert("Utilisateur mis à jour !");
        } else {
            // Create new
            const emailExists = Object.values(users).some(u => u.email === email);
            if (emailExists) {
                alert("Cet email est déjà utilisé !");
                return;
            }

            const newId = 'v_' + Date.now();
            const newUser = {
                id: newId,
                email: email,
                password: password || '123456',
                role: 'vendeuse',
                name: `${firstName} ${lastName}`,
                status: isActive ? 'active' : 'inactive',
                createdAt: new Date().toISOString(),
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName + '+' + lastName)}&background=random`
            };

            users[newId] = newUser;
            Storage.set('users', users);
            alert("Utilisateur créé avec succès !");
        }

        this.closeUserModal();
        this.loadUsers();
        this.loadDashboardData();
    },

    loadUsers(filter = 'all') {
        const users = StorageHelper.getUsers();
        const tbody = document.getElementById('users-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        // Inject filter buttons if missing (Simple fix to ensure button existence)
        const filterContainer = document.querySelector('#view-users .flex.gap-2');
        if (filterContainer) {
            const hasButtons = filterContainer.querySelectorAll('button').length > 0;
            if (!hasButtons || filterContainer.innerHTML.trim() === '') {
                // Re-inject buttons if they are missing or empty
                filterContainer.innerHTML = `
                    <button onclick="AdminApp.loadUsers('all')" class="filter-btn px-4 py-2 border rounded-lg text-sm font-medium transition-colors" data-filter="all">Tous</button>
                    <button onclick="AdminApp.loadUsers('active')" class="filter-btn px-4 py-2 border rounded-lg text-sm font-medium transition-colors" data-filter="active">Actifs</button>
                    <button onclick="AdminApp.loadUsers('inactive')" class="filter-btn px-4 py-2 border rounded-lg text-sm font-medium transition-colors" data-filter="inactive">Inactifs</button>
                 `;
            }
        }

        // Highlight Active Filter
        document.querySelectorAll('.filter-btn').forEach(btn => {
            const btnFilter = btn.getAttribute('data-filter') || 'all'; // Fallback
            if (btnFilter === filter) {
                btn.className = 'filter-btn px-4 py-2 bg-primary/10 text-primary border-primary/20 border rounded-lg text-sm font-medium transition-colors';
            } else {
                btn.className = 'filter-btn px-4 py-2 bg-white border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 border rounded-lg text-sm font-medium transition-colors';
            }
        });

        // Render Rows
        Object.values(users).forEach(user => {
            if (user.role === 'admin') return;

            const isUserActive = user.status !== 'inactive';
            if (filter === 'active' && !isUserActive) return;
            if (filter === 'inactive' && isUserActive) return;

            // Ensure ID is properly escaped for onclick
            const userId = user.id;

            const tr = document.createElement('tr');
            tr.className = `hover:bg-gray-50/50 transition-colors group ${!isUserActive ? 'opacity-60 bg-gray-50' : ''}`;
            tr.innerHTML = `
                <td class="px-6 py-4">
                     <input type="checkbox" class="rounded text-primary focus:ring-primary border-gray-300">
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center">
                        <img class="h-10 w-10 rounded-full border border-gray-200" src="${user.avatar || 'https://ui-avatars.com/api/?background=random'}" alt="">
                        <div class="ml-3">
                            <div class="text-sm font-medium text-gray-900">${user.name}</div>
                            <div class="text-xs text-gray-500">${user.email}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        ${user.role}
                    </span>
                </td>
                <td class="px-6 py-4">
                    ${isUserActive
                    ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                             <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Actif
                           </span>`
                    : `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">Inactif</span>`
                }
                </td>
                <td class="px-6 py-4 text-xs text-gray-500">
                    ${user.sessionStart ? new Date(user.sessionStart).toLocaleDateString() : 'Jamais'}
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onclick="AdminApp.editUser('${userId}')" class="p-1 text-gray-400 hover:text-blue-600 rounded bg-white border border-gray-200 hover:border-blue-200 transition-all" title="Modifier">
                            <span class="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button type="button" onclick="AdminApp.toggleUserStatus('${userId}')" class="p-1 text-gray-400 hover:text-${isUserActive ? 'red' : 'green'}-600 rounded bg-white border border-gray-200 hover:border-${isUserActive ? 'red' : 'green'}-200 transition-all" title="${isUserActive ? 'Désactiver' : 'Activer'}">
                            <span class="material-symbols-outlined text-lg">${isUserActive ? 'block' : 'check_circle'}</span>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    editUser(userId) {
        const users = StorageHelper.getUsers();
        const user = users[userId];
        if (!user) {
            alert('Utilisateur introuvable');
            return;
        }

        this.openUserModal();

        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) modalTitle.textContent = "Modifier Vendeuse";

        document.getElementById('user-id').value = user.id;

        const names = user.name.split(' ');
        document.getElementById('user-firstname').value = names[0] || '';
        document.getElementById('user-lastname').value = names.slice(1).join(' ') || '';
        document.getElementById('user-email').value = user.email;
        document.getElementById('user-password').value = '';
        document.getElementById('user-password').placeholder = "Laisser vide pour ne pas changer";
        document.getElementById('user-active').checked = user.status !== 'inactive';
    },

    toggleUserStatus(userId) {
        const users = StorageHelper.getUsers();
        if (users[userId]) {
            const currentStatus = users[userId].status || 'active';
            users[userId].status = currentStatus === 'active' ? 'inactive' : 'active';
            Storage.set('users', users);
            this.loadUsers();
            this.loadDashboardData();
        }
    },

    // --- DETAILS ACTIONS ---

    viewSellerDetails(sellerId) {
        const users = StorageHelper.getUsers();
        const user = users[sellerId];
        if (!user) return;

        StorageHelper.getSales().then(allSales => {
            // Using loose comparison for ID match is safer when dealing with mixed string/int IDs
            const sales = allSales.filter(sale => sale.vendeuseId == sellerId);

            const total = sales.reduce((acc, s) => acc + s.total, 0);
            const count = sales.length;
            const avg = count > 0 ? total / count : 0;

            // Populate Modal Header
            const elName = document.getElementById('seller-detail-name');
            const elEmail = document.getElementById('seller-detail-email');
            const elAvatar = document.getElementById('seller-detail-avatar');

            if (elName) elName.textContent = user.name;
            if (elEmail) elEmail.textContent = user.email;
            if (elAvatar) elAvatar.src = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}`;

            // Populate KPIs
            const elTotal = document.getElementById('seller-detail-total');
            const elCount = document.getElementById('seller-detail-count');
            const elAvg = document.getElementById('seller-detail-avg');

            if (elTotal) elTotal.textContent = this.formatCurrency(total);
            if (elCount) elCount.textContent = count;
            if (elAvg) elAvg.textContent = this.formatCurrency(avg);

            // Populate History Table
            const tbody = document.getElementById('seller-detail-history');
            if (tbody) {
                tbody.innerHTML = '';

                const sortedSales = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date));

                sortedSales.forEach(sale => {
                    const tr = document.createElement('tr');
                    tr.className = 'hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-0';

                    // Format items tooltip or list
                    const itemsSummary = sale.items ? sale.items.map(i => `${i.quantity}x ${i.name}`).join(', ') : 'Articles inconnus';
                    const itemsDetail = sale.items ? sale.items.map(i => `<div class="flex justify-between text-xs text-gray-500"><span class="truncate pr-2">${i.quantity}x ${i.name}</span><span>${this.formatCurrency(i.price * i.quantity)}</span></div>`).join('') : '';

                    tr.innerHTML = `
                        <td class="px-6 py-4 align-top text-gray-500">
                            ${new Date(sale.date).toLocaleDateString()} 
                            <div class="text-xs text-gray-400">${new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td class="px-6 py-4 align-top">
                            <div class="font-medium text-gray-900">${sale.clienteName || sale.clientName || 'Client de passage'}</div>
                            <button onclick="this.nextElementSibling.classList.toggle('hidden')" class="text-xs text-primary hover:underline mt-1 text-left flex items-center">
                                Voir ${sale.items ? sale.items.length : 0} articles <span class="material-symbols-outlined text-[10px] ml-1">expand_more</span>
                            </button>
                            <div class="hidden mt-2 p-2 bg-gray-50 rounded-lg space-y-1">
                                ${itemsDetail}
                            </div>
                        </td>
                        <td class="px-6 py-4 align-top">
                            <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                ${(sale.paymentMethod || sale.method) === 'cash' ? 'Espèces' : (sale.paymentMethod || sale.method) === 'card' ? 'Carte' : 'Mobile'}
                            </span>
                        </td>
                        <td class="px-6 py-4 align-top text-right font-bold text-gray-900">
                            ${this.formatCurrency(sale.total)}
                        </td>
                    `;
                    tbody.appendChild(tr);
                });

                if (sortedSales.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-gray-400">Aucune vente enregistrée pour cette vendeuse.</td></tr>`;
                }
            }

            this.openSellerModal();
        });
    },

    openSellerModal() {
        const modal = document.getElementById('seller-details-modal');
        const content = document.getElementById('seller-modal-content');
        if (!modal) return;

        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            modal.classList.remove('opacity-0');
            if (content) {
                content.classList.remove('scale-95');
                content.classList.add('scale-100');
            }
        });
    },

    closeSellerModal() {
        const modal = document.getElementById('seller-details-modal');
        const content = document.getElementById('seller-modal-content');
        if (!modal) return;

        modal.classList.add('opacity-0');
        if (content) {
            content.classList.remove('scale-100');
            content.classList.add('scale-95');
        }

        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    },

    // --- MODALS ---
    openUserModal() {
        const modal = document.getElementById('user-modal');
        const content = document.getElementById('user-modal-content');
        if (!modal || !content) return;

        modal.classList.remove('hidden');

        // If ID field is empty, it's a new user -> reset form
        const idField = document.getElementById('user-id');
        if (idField && !idField.value) {
            const modalTitle = document.getElementById('modal-title');
            if (modalTitle) modalTitle.textContent = "Ajouter une Vendeuse";
            document.getElementById('user-form').reset();
        }

        requestAnimationFrame(() => {
            modal.classList.remove('opacity-0');
            content.classList.remove('scale-95');
            content.classList.add('scale-100');
        });
    },

    closeUserModal() {
        const modal = document.getElementById('user-modal');
        const content = document.getElementById('user-modal-content');
        if (!modal || !content) return;

        modal.classList.add('opacity-0');
        content.classList.remove('scale-100');
        content.classList.add('scale-95');

        setTimeout(() => {
            modal.classList.add('hidden');
            // Reset ID after closing to avoid conflicts
            document.getElementById('user-id').value = '';
        }, 300);
    },

    // --- REPORTS ---

    async loadReports(period = 'month') {
        const sales = await StorageHelper.getSales();
        const filteredSales = this.filterSalesByPeriod(sales, period);

        // Basic KPIs
        const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
        const count = filteredSales.length;
        const avgCart = count > 0 ? totalRevenue / count : 0;

        // Payment Methods
        const payments = { cash: 0, card: 0, mobile: 0 };
        filteredSales.forEach(s => {
            // Handle case sensitivity just in case
            const m = (s.paymentMethod || s.method || 'cash').toLowerCase();
            // Map to keys
            let key = 'cash';
            if (m.includes('card') || m.includes('carte')) key = 'card';
            else if (m.includes('mobile')) key = 'mobile';

            if (payments[key] !== undefined) payments[key] += s.total;
        });

        // Advanced KPIs: Best Product & Best Client
        const productStats = {};
        const clientStats = {};

        filteredSales.forEach(sale => {
            // Client Stats
            if (sale.clienteId || sale.clientId) {
                const cId = sale.clienteId || sale.clientId;
                const cName = sale.clienteName || sale.clientName || 'Inconnu';

                if (!clientStats[cId]) clientStats[cId] = { name: cName, total: 0, count: 0 };
                clientStats[cId].total += sale.total;
                clientStats[cId].count += 1;
            }

            // Product Stats
            if (sale.items && Array.isArray(sale.items)) {
                sale.items.forEach(item => {
                    const id = item.id || item.productId;
                    if (!productStats[id]) productStats[id] = { name: item.name, qty: 0, revenue: 0 };
                    productStats[id].qty += (item.quantity || 1);
                    productStats[id].revenue += (item.price * (item.quantity || 1));
                });
            }
        });

        const sortedProducts = Object.values(productStats).sort((a, b) => b.qty - a.qty);
        const bestProduct = sortedProducts[0] || null;

        const sortedClients = Object.values(clientStats).sort((a, b) => b.total - a.total);
        const bestClient = sortedClients[0] || null;

        this.renderReports(period, totalRevenue, count, avgCart, payments, filteredSales, bestProduct, bestClient);
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
            } else if (period === 'year') {
                return d.getFullYear() === today.getFullYear();
            }
            return true;
        });
    },

    renderReports(period, revenue, count, avg, payments, sales, bestProduct, bestClient) {
        const container = document.getElementById('view-reports');
        if (!container) return;

        const periodLabels = { day: "Aujourd'hui", week: "Cette Semaine", month: "Ce Mois", year: "Cette Année" };

        container.innerHTML = `
            <!-- Controls -->
            <div class="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 gap-4">
                <div class="flex bg-gray-100 rounded-lg p-1">
                    ${['day', 'week', 'month', 'year'].map(p => `
                        <button onclick="AdminApp.loadReports('${p}')" 
                            class="px-4 py-2 text-sm font-medium rounded-md transition-all ${period === p ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-900'}">
                            ${periodLabels[p]}
                        </button>
                    `).join('')}
                </div>
                <button onclick="AdminApp.exportReportToExcel('${period}')" class="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm">
                    <span class="material-symbols-outlined mr-2 text-lg">download</span>
                    Exporter Excel
                </button>
            </div>

            <!-- KPI Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <!-- Revenue -->
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div class="flex justify-between items-start mb-4">
                         <div class="p-2 bg-blue-50 text-blue-600 rounded-lg"><span class="material-symbols-outlined">payments</span></div>
                    </div>
                    <p class="text-sm text-gray-500 font-medium">Chiffre d'Affaires</p>
                    <p class="text-2xl font-bold text-gray-900 mt-1">${this.formatCurrency(revenue)}</p>
                </div>
                
                <!-- Count -->
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                     <div class="flex justify-between items-start mb-4">
                         <div class="p-2 bg-purple-50 text-purple-600 rounded-lg"><span class="material-symbols-outlined">shopping_cart</span></div>
                    </div>
                    <p class="text-sm text-gray-500 font-medium">Nombre de Ventes</p>
                    <p class="text-2xl font-bold text-gray-900 mt-1">${count}</p>
                </div>

                <!-- Best Product -->
                 <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                     <div class="flex justify-between items-start mb-4">
                         <div class="p-2 bg-orange-50 text-orange-600 rounded-lg"><span class="material-symbols-outlined">star</span></div>
                    </div>
                    <p class="text-sm text-gray-500 font-medium">Meilleur Article</p>
                    <div class="mt-1">
                        <p class="text-lg font-bold text-gray-900 truncate" title="${bestProduct ? bestProduct.name : ''}">${bestProduct ? bestProduct.name : '-'}</p>
                        <p class="text-xs text-gray-400">${bestProduct ? bestProduct.qty + ' vendus' : 'Aucune donnée'}</p>
                    </div>
                </div>

                <!-- Best Client -->
                 <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                     <div class="flex justify-between items-start mb-4">
                         <div class="p-2 bg-pink-50 text-pink-600 rounded-lg"><span class="material-symbols-outlined">person_celebrate</span></div>
                    </div>
                    <p class="text-sm text-gray-500 font-medium">Meilleur Client</p>
                    <div class="mt-1">
                        <p class="text-lg font-bold text-gray-900 truncate" title="${bestClient ? bestClient.name : ''}">${bestClient ? bestClient.name : '-'}</p>
                        <p class="text-xs text-gray-400">${bestClient ? this.formatCurrency(bestClient.total) : 'Aucune donnée'}</p>
                    </div>
                </div>
            </div>

            <div class="flex flex-col lg:flex-row gap-6 mb-8">
                <div class="w-full lg:w-1/3 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 class="text-lg font-bold text-gray-900 mb-4">Méthodes de Paiement</h3>
                    <div style="height:250px; position:relative;">
                        <canvas id="paymentChart"></canvas>
                    </div>
                </div>
                <div class="w-full lg:w-2/3 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                     <div class="p-6 border-b border-gray-100 flex justify-between items-center">
                        <h3 class="text-lg font-bold text-gray-900">Transactions de la Période</h3>
                     </div>
                     <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse text-sm">
                            <thead class="bg-gray-50/50 text-gray-500 uppercase text-xs">
                                <tr>
                                    <th class="px-6 py-3">Date</th>
                                    <th class="px-6 py-3">ID</th>
                                    <th class="px-6 py-3">Client</th>
                                    <th class="px-6 py-3 text-right">Montant</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100">
                                ${sales.slice().reverse().slice(0, 50).map(s => `
                                    <tr>
                                        <td class="px-6 py-3 text-gray-500">${new Date(s.date).toLocaleDateString()} ${new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td class="px-6 py-3 font-mono text-xs text-gray-400">#${s.id.slice(0, 8)}...</td>
                                        <td class="px-6 py-3 font-medium text-gray-900">${s.clienteName || s.clientName || 'Anonyme'}</td>
                                        <td class="px-6 py-3 text-right font-medium">${this.formatCurrency(s.total)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                     </div>
                </div>
            </div>
        `;

        this.initReportsCharts(payments);
    },

    exportReportToExcel(period) {
        StorageHelper.getSales().then(allSales => {
            const sales = this.filterSalesByPeriod(allSales, period);

            // Define CSV Headers
            const headers = ["ID", "Date", "Heure", "Vendeuse", "Client", "Articles", "Méthode Paiement", "Total"];

            // Format Rows
            const rows = sales.map(s => {
                const itemSummary = s.items ? s.items.map(i => `${i.quantity}x ${i.name}`).join('; ') : '';
                return [
                    s.id,
                    new Date(s.date).toLocaleDateString('fr-FR'),
                    new Date(s.date).toLocaleTimeString('fr-FR'),
                    s.vendeuseName || 'N/A',
                    s.clienteName || s.clientName || 'Anonyme',
                    `"${itemSummary.replace(/"/g, '""')}"`, // Quote to handle commas/semicolons and escape quotes
                    s.paymentMethod || s.method,
                    s.total
                ].join(',');
            });

            // Combine with BOM for Excel UTF-8 recognition
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

    initReportsCharts(payments) {
        const ctx = document.getElementById('paymentChart');
        // Destroy existing chart if any? Usually simple re-init is risky without destroy.
        // For now, assuming simple refresh by replacing canvas might be better or checking for instance.
        // With overwrite, it's safer.
        if (ctx) {
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Espèces', 'Carte', 'Mobile'],
                    datasets: [{
                        data: [payments.cash, payments.card, payments.mobile],
                        backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { usePointStyle: true, font: { family: 'Inter' } } }
                    },
                    cutout: '70%'
                }
            });
        }
    },

    // --- TOP CLIENTS ---
    async loadTopClients() {
        const sales = await StorageHelper.getSales();
        const clientStats = {};
        const clients = StorageHelper.getClients(); // Optional lookup for better details

        sales.forEach(s => {
            const cid = s.clientId || s.clienteId;
            if (!cid) return;

            if (!clientStats[cid]) {
                const clientName = s.clientName || s.clienteName || 'Client';
                clientStats[cid] = {
                    name: clientName,
                    count: 0,
                    total: 0,
                    lastDate: s.date
                };
            }
            clientStats[cid].count++;
            clientStats[cid].total += s.total;
            if (new Date(s.date) > new Date(clientStats[cid].lastDate)) {
                clientStats[cid].lastDate = s.date;
            }
        });

        const sortedClients = Object.values(clientStats).sort((a, b) => b.total - a.total).slice(0, 10);

        const container = document.getElementById('view-clients');
        if (!container) return;

        container.innerHTML = `
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider">
                                <th class="px-6 py-4 font-semibold">Rang</th>
                                <th class="px-6 py-4 font-semibold">Client</th>
                                <th class="px-6 py-4 font-semibold text-right">Dépenses Totales</th>
                                <th class="px-6 py-4 font-semibold text-right">Commandes</th>
                                <th class="px-6 py-4 font-semibold text-right">Panier Moyen</th>
                                <th class="px-6 py-4 font-semibold">Dernière visite</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 text-sm">
                            ${sortedClients.map((c, index) => `
                                <tr class="hover:bg-gray-50/50 transition-colors">
                                    <td class="px-6 py-4 text-gray-400 font-mono">#${index + 1}</td>
                                    <td class="px-6 py-4">
                                        <div class="flex items-center">
                                            <div class="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs mr-3">
                                                ${c.name.charAt(0)}
                                            </div>
                                            <div class="font-medium text-gray-900">${c.name}</div>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 text-right font-bold text-gray-900">
                                        ${this.formatCurrency(c.total)}
                                    </td>
                                    <td class="px-6 py-4 text-right text-gray-600">${c.count}</td>
                                    <td class="px-6 py-4 text-right text-gray-500">
                                        ${this.formatCurrency(c.total / c.count)}
                                    </td>
                                    <td class="px-6 py-4 text-gray-500 text-xs">
                                        ${new Date(c.lastDate).toLocaleDateString()}
                                    </td>
                                </tr>
                            `).join('')}
                            ${sortedClients.length === 0 ? '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-400">Aucune donnée client disponible</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    // --- SETTINGS (Load/Save/Apply) ---
    loadSettings() {
        const saved = Storage.get('settings');
        if (saved) {
            this.settings = { ...this.settings, ...saved };
        }
    },

    fillSettingsForm() {
        if (document.getElementById('setting-store-name')) document.getElementById('setting-store-name').value = this.settings.storeName;
        if (document.getElementById('setting-store-email')) document.getElementById('setting-store-email').value = this.settings.email;
        if (document.getElementById('setting-currency')) document.getElementById('setting-currency').value = this.settings.currency;
        if (document.getElementById('setting-tax-rate')) document.getElementById('setting-tax-rate').value = this.settings.taxRate;
        if (document.getElementById('setting-darkmode')) document.getElementById('setting-darkmode').checked = this.settings.darkMode;
    },

    saveSettings(e) {
        e.preventDefault();

        // Update Local State
        this.settings.storeName = document.getElementById('setting-store-name').value;
        this.settings.email = document.getElementById('setting-store-email').value;
        this.settings.currency = document.getElementById('setting-currency').value;
        this.settings.taxRate = document.getElementById('setting-tax-rate').value;

        // Save to Storage
        Storage.set('settings', this.settings);

        // Apply changes instantly
        this.applyAppState();

        alert('Paramètres enregistrés avec succès !');
    },

    toggleDarkMode(e) {
        this.settings.darkMode = e.target.checked;
        Storage.set('settings', this.settings);
        this.applyAppState();
    },

    applyAppState() {
        // Apply Store Name to Sidebar
        const titleEl = document.querySelector('aside h1');
        if (titleEl) titleEl.textContent = this.settings.storeName;

        // Apply Currency to KPIs (Just iterate relevant logic or re-render dashboard if visible)
        if (this.currentView === 'dashboard') this.loadDashboardData();

        // Apply Dark Mode (Basic Class Toggle)
        if (this.settings.darkMode) {
            document.documentElement.classList.add('dark');
            document.body.classList.add('bg-gray-900', 'text-white');
            document.body.classList.remove('bg-bgLight', 'text-slate-800');
        } else {
            document.documentElement.classList.remove('dark');
            document.body.classList.remove('bg-gray-900', 'text-white');
            document.body.classList.add('bg-bgLight', 'text-slate-800');
        }
    },

    resetApp() {
        if (confirm('ACTION IRRÉVERSIBLE : Voulez-vous vraiment réinitialiser toutes les données de l\'application ? Toutes les ventes et utilisateurs créés seront perdus.')) {
            if (StorageHelper.resetDatabase()) {
                alert('Base de données réinitialisée. La page va se recharger.');
                location.reload();
            }
        }
    },

    exportData() {
        const data = {
            users: StorageHelper.getUsers(),
            products: StorageHelper.getProducts(),
            clients: StorageHelper.getClients(),
            sales: Storage.get('sales') || [],
            settings: Storage.get('settings') || null,
            exportedAt: new Date().toISOString()
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "retailos_backup_" + new Date().toISOString().slice(0, 10) + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    },

    async initChart() {
        const ctx = document.getElementById('salesChart');
        if (!ctx) return;

        // Get real sales data for the last 30 days
        const sales = await StorageHelper.getSales();
        const today = new Date();
        const labels = [];
        const data = [];

        // Generate last 30 days labels and aggregate sales
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toDateString();

            // Format label as day/month
            const dayLabel = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
            labels.push(dayLabel);

            // Sum sales for this day
            const dayTotal = sales
                .filter(s => new Date(s.date).toDateString() === dateStr)
                .reduce((sum, s) => sum + (s.total || 0), 0);
            data.push(dayTotal);
        }

        // Destroy existing chart if any
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        this.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ventes',
                    data: data,
                    borderColor: '#137fec',
                    backgroundColor: 'rgba(19, 127, 236, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#137fec',
                    pointBorderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: { family: 'Inter', size: 13 },
                        bodyFont: { family: 'Inter', size: 13 },
                        callbacks: {
                            label: (context) => {
                                return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: this.settings.currency }).format(context.raw);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { display: true, borderDash: [4, 4], color: '#f1f5f9' },
                        ticks: { font: { family: 'Inter', size: 11 }, color: '#94a3b8' },
                        border: { display: false }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { family: 'Inter', size: 10 },
                            color: '#94a3b8',
                            maxRotation: 45,
                            minRotation: 45
                        },
                        border: { display: false }
                    }
                }
            }
        });
    },

    loadCaisseGlobalView() {
        const history = StorageHelper.getCashHistory();
        const tbody = document.getElementById('caisse-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';
        // Sort by date desc
        history.sort((a, b) => new Date(b.date) - new Date(a.date));

        history.forEach(entry => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-0';

            // Define badge for action type
            let badgeClass = 'bg-gray-100 text-gray-800';
            let actionText = entry.type;
            let icon = 'info';

            if (entry.type === 'OPEN') {
                badgeClass = 'bg-green-100 text-green-800';
                actionText = 'OUVERTURE';
                icon = 'lock_open';
            } else if (entry.type === 'CLOSE') {
                badgeClass = 'bg-red-100 text-red-800';
                actionText = 'FERMETURE';
                icon = 'lock';
            } else if (entry.type === 'WITHDRAWAL') {
                badgeClass = 'bg-orange-100 text-orange-800';
                actionText = 'RETRAIT';
                icon = 'payments';
            }

            // Reason or Diff
            let details = entry.reason || '-';
            if (entry.type === 'CLOSE') {
                const diff = (entry.difference || 0);
                const diffClass = diff < 0 ? 'text-red-500 font-bold' : (diff > 0 ? 'text-green-500 font-bold' : 'text-gray-500');
                details = `Écart: <span class="${diffClass}">${this.formatCurrency(diff)}</span>`;
            }

            tr.innerHTML = `
                <td class="px-6 py-4 text-gray-500 text-xs">
                    ${new Date(entry.date).toLocaleString('fr-FR')}
                </td>
                <td class="px-6 py-4 font-medium text-gray-900">
                    ${entry.userName || 'Unknown'}
                </td>
                <td class="px-6 py-4">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeClass}">
                        <span class="material-symbols-outlined text-[14px] mr-1">${icon}</span> ${actionText}
                    </span>
                </td>
                <td class="px-6 py-4 text-xs text-gray-600">
                    ${details}
                </td>
                <td class="px-6 py-4 text-right font-bold text-gray-900">
                    ${this.formatCurrency(entry.amount)}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
};

// Start
window.addEventListener('load', () => {
    // Explicitly expose to window to ensure HTML event handlers work (e.g., onclick="AdminApp.switchView()")
    window.AdminApp = AdminApp;
    AdminApp.init();
});
