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
        ['dashboard', 'pos', 'history', 'clients', 'caisse'].forEach(v => {
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
            clients: "Mes Clientes",
            caisse: "Gestion de Caisse"
        };
        const subtext = {
            dashboard: "Prêt pour une excellente journée de vente ?",
            pos: "Ajoutez des produits au panier pour commencer.",
            history: "Consultez vos performances passées.",
            clients: "Gérez votre carnet d'adresses.",
            caisse: "Ouverture, fermeture et sorties de caisse."
        };

        const titleEl = document.getElementById('view-title');
        const subEl = document.getElementById('view-subtitle');
        if (titleEl) titleEl.textContent = titles[viewId];
        if (subEl) subEl.textContent = subtext[viewId];

        // Specific Loads
        if (viewId === 'history') this.loadHistory();
        if (viewId === 'caisse') this.loadCaisseView();
        if (viewId === 'clients') this.loadClientsView();
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
                                <div class="text-xs text-gray-500 mt-0.5">
                                    <p>${new Date(sale.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} • ${sale.items.length} articles</p>
                                    <p class="text-gray-400 truncate max-w-[200px]">${sale.items.map(i => `${i.quantity} ${i.name}`).join(', ')}</p>
                                </div>
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
            tr.className = 'hover:bg-gray-50 border-b border-gray-100 last:border-0';

            // Format items list
            const itemsList = sale.items.map(i =>
                `<div class="flex justify-between text-xs text-gray-500"><span class="truncate pr-2">${i.quantity}x ${i.name}</span><span>${this.formatCurrency(i.total)}</span></div>`
            ).join('');

            tr.innerHTML = `
                <td class="p-4 align-top">
                    <div class="font-mono text-gray-600 text-xs font-bold mb-1">${sale.id.slice(-8)}</div>
                    <div class="text-xs text-gray-400">${new Date(sale.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                </td>
                <td class="p-4 align-top">
                    <div class="font-medium text-gray-900">${sale.clienteName || sale.clientName || 'Passage'}</div>
                    <div class="mt-2 space-y-1 bg-gray-50 p-2 rounded-lg">
                        ${itemsList}
                    </div>
                </td>
                <td class="p-4 align-top text-right font-bold text-gray-900">${this.formatCurrency(sale.total)}</td>
                <td class="p-4 align-top text-center">
                    <span class="px-2 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700 uppercase">Payé (${sale.paymentMethod})</span>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    // CASH REGISTER VIEW
    loadCaisseView() {
        const container = document.getElementById('view-caisse');
        if (!container) return;

        const cashRegister = StorageHelper.getCashRegister();
        const isOpen = cashRegister && cashRegister.status === 'open';

        container.innerHTML = `
            <div class="p-6 lg:p-8 space-y-6 pb-24 lg:pb-8">
                <!-- Status Banner -->
                <div class="bg-white rounded-2xl p-6 shadow-sm border ${isOpen ? 'border-green-200' : 'border-gray-200'}">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 rounded-xl ${isOpen ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'} flex items-center justify-center">
                                <span class="material-symbols-outlined text-3xl">${isOpen ? 'point_of_sale' : 'lock'}</span>
                            </div>
                            <div>
                                <h3 class="text-xl font-bold ${isOpen ? 'text-green-700' : 'text-gray-700'}">${isOpen ? 'Caisse Ouverte' : 'Caisse Fermée'}</h3>
                                <p class="text-sm text-gray-500">${isOpen ? 'Ouverte le ' + new Date(cashRegister.openedAt).toLocaleString('fr-FR') + ' par ' + cashRegister.openedByName : 'Ouvrez la caisse pour commencer'}</p>
                            </div>
                        </div>
                        ${isOpen ? `
                            <div class="text-right">
                                <p class="text-sm text-gray-500">Montant actuel</p>
                                <p class="text-2xl font-bold text-gray-900">${this.formatCurrency(cashRegister.currentAmount)}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>

                ${!isOpen ? `
                    <!-- Open Cash Register Form -->
                    <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <h3 class="text-lg font-bold text-gray-900 mb-4">Ouvrir la Caisse</h3>
                        <form onsubmit="VendeuseApp.openCaisse(event)" class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Montant initial</label>
                                <input type="number" id="caisse-initial-amount" min="0" step="100" required
                                    class="w-full rounded-xl border-gray-300 border px-4 py-3 text-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                    placeholder="Ex: 50000">
                            </div>
                            <button type="submit" 
                                class="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
                                <span class="material-symbols-outlined">lock_open</span>
                                Ouvrir la Caisse
                            </button>
                        </form>
                    </div>
                ` : `
                    <!-- KPI Cards -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                            <p class="text-xs font-medium text-gray-500 uppercase">Montant Initial</p>
                            <p class="text-xl font-bold text-gray-900 mt-1">${this.formatCurrency(cashRegister.initialAmount)}</p>
                        </div>
                        <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                            <p class="text-xs font-medium text-gray-500 uppercase">Ventes du Jour</p>
                            <p class="text-xl font-bold text-green-600 mt-1">+${this.formatCurrency(cashRegister.salesTotal)}</p>
                        </div>
                        <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                            <p class="text-xs font-medium text-gray-500 uppercase">Sorties</p>
                            <p class="text-xl font-bold text-red-600 mt-1">-${this.formatCurrency(cashRegister.withdrawals.reduce((sum, w) => sum + w.amount, 0))}</p>
                        </div>
                    </div>

                    <!-- Withdrawal Form -->
                    <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <h3 class="text-lg font-bold text-gray-900 mb-4">Sortie de Caisse</h3>
                        <form onsubmit="VendeuseApp.addWithdrawal(event)" class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Montant</label>
                                <input type="number" id="withdrawal-amount" min="1" required
                                    class="w-full rounded-lg border-gray-300 border px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                                    placeholder="Montant">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Motif *</label>
                                <input type="text" id="withdrawal-reason" required
                                    class="w-full rounded-lg border-gray-300 border px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                                    placeholder="Raison de la sortie">
                            </div>
                            <div class="flex items-end">
                                <button type="submit" 
                                    class="w-full py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2">
                                    <span class="material-symbols-outlined text-lg">remove_circle</span>
                                    Retirer
                                </button>
                            </div>
                        </form>
                    </div>

                    <!-- Withdrawals List -->
                    ${cashRegister.withdrawals.length > 0 ? `
                        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div class="p-4 bg-gray-50 border-b border-gray-100">
                                <h3 class="font-bold text-gray-800">Sorties de Caisse</h3>
                            </div>
                            <div class="divide-y divide-gray-100">
                                ${cashRegister.withdrawals.map(w => `
                                    <div class="p-4 flex items-center justify-between">
                                        <div>
                                            <p class="font-medium text-gray-900">${w.reason}</p>
                                            <p class="text-xs text-gray-500">${new Date(w.date).toLocaleTimeString('fr-FR')} • ${w.userName}</p>
                                        </div>
                                        <span class="font-bold text-red-600">-${this.formatCurrency(w.amount)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Close Cash Register -->
                    <div class="bg-white rounded-2xl p-6 shadow-sm border border-orange-200">
                        <h3 class="text-lg font-bold text-gray-900 mb-4">Fermer la Caisse</h3>
                        <form onsubmit="VendeuseApp.closeCaisse(event)" class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Montant final en caisse</label>
                                <input type="number" id="caisse-final-amount" min="0" step="100" required
                                    class="w-full rounded-xl border-gray-300 border px-4 py-3 text-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                    placeholder="Comptez l'argent en caisse">
                            </div>
                            <button type="submit" 
                                class="w-full py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-colors flex items-center justify-center gap-2">
                                <span class="material-symbols-outlined">lock</span>
                                Fermer la Caisse
                            </button>
                        </form>
                    </div>
                `}
                
                <!-- Full History Section -->
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-8">
                    <div class="p-6 border-b border-gray-100 flex items-center justify-between">
                        <h3 class="font-bold text-gray-900 text-lg">Historique des Opérations</h3>
                        <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">Récent</span>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left">
                            <thead class="bg-gray-50 text-gray-500 text-xs uppercase">
                                <tr>
                                    <th class="p-4">Date</th>
                                    <th class="p-4">Type</th>
                                    <th class="p-4">Détails</th>
                                    <th class="p-4 text-right">Montant</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100 text-sm">
                                ${StorageHelper.getCashHistory().slice().reverse().slice(0, 50).map(entry => {
            let typeLabel = entry.type;
            let color = 'gray';
            if (entry.type === 'OPEN') { typeLabel = 'Ouverture'; color = 'green'; }
            else if (entry.type === 'CLOSE') { typeLabel = 'Fermeture'; color = 'red'; }
            else if (entry.type === 'WITHDRAWAL') { typeLabel = 'Retrait'; color = 'orange'; }

            return `
                                    <tr class="hover:bg-gray-50/50">
                                        <td class="p-4">
                                            <div class="font-medium text-gray-900">${new Date(entry.date).toLocaleDateString()}</div>
                                            <div class="text-xs text-gray-400">${new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td class="p-4">
                                            <span class="px-2 py-1 rounded text-xs font-bold bg-${color}-100 text-${color}-700 uppercase">${typeLabel}</span>
                                        </td>
                                        <td class="p-4 text-gray-600">
                                            ${entry.reason || (entry.type === 'CLOSE' ? `Écart: ${this.formatCurrency(entry.difference || 0)}` : '-')}
                                        </td>
                                        <td class="p-4 text-right font-bold text-gray-900">${this.formatCurrency(entry.amount)}</td>
                                    </tr>
                                    `;
        }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    openCaisse(event) {
        event.preventDefault();
        const amount = parseFloat(document.getElementById('caisse-initial-amount').value);
        if (amount < 0) {
            alert('Le montant doit être positif');
            return;
        }
        StorageHelper.openCashRegister(amount, this.currentUser.id, this.currentUser.name);
        alert('Caisse ouverte avec succès !');
        this.loadCaisseView();
    },

    addWithdrawal(event) {
        event.preventDefault();
        const amount = parseFloat(document.getElementById('withdrawal-amount').value);
        const reason = document.getElementById('withdrawal-reason').value.trim();

        if (!reason) {
            alert('Le motif est obligatoire');
            return;
        }

        const result = StorageHelper.addCashWithdrawal(amount, reason, this.currentUser.id, this.currentUser.name);
        if (result.success) {
            alert('Sortie de caisse enregistrée');
            this.loadCaisseView();
        } else {
            alert(result.message);
        }
    },

    closeCaisse(event) {
        event.preventDefault();
        const finalAmount = parseFloat(document.getElementById('caisse-final-amount').value);

        if (!confirm('Êtes-vous sûr de vouloir fermer la caisse ?')) return;

        const result = StorageHelper.closeCashRegister(finalAmount, this.currentUser.id, this.currentUser.name);
        if (result.success) {
            const diff = result.cashRegister.difference;
            const diffText = diff === 0 ? 'Aucun écart' : (diff > 0 ? `Excédent de ${this.formatCurrency(diff)}` : `Manque de ${this.formatCurrency(Math.abs(diff))}`);
            alert(`Caisse fermée avec succès !\n\nMontant attendu: ${this.formatCurrency(result.cashRegister.expectedAmount)}\nMontant réel: ${this.formatCurrency(finalAmount)}\n${diffText}`);
            this.loadCaisseView();
        } else {
            alert(result.message);
        }
    },

    // CLIENTS VIEW
    loadClientsView() {
        const container = document.getElementById('view-clients');
        if (!container) return;

        const clients = StorageHelper.getClients();

        container.innerHTML = `
            <div class="p-6 lg:p-8 space-y-6 pb-24 lg:pb-8">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div class="relative flex-1 max-w-md">
                        <span class="material-symbols-outlined absolute left-3 top-2.5 text-gray-400">search</span>
                        <input type="text" id="client-search" placeholder="Rechercher un client..."
                            oninput="VendeuseApp.filterClients(this.value)"
                            class="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent">
                    </div>
                    <button onclick="VendeuseApp.openNewClientModal()" 
                        class="flex items-center px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-blue-600 transition-colors shadow-lg shadow-primary/30">
                        <span class="material-symbols-outlined mr-2">person_add</span>
                        Nouveau Client
                    </button>
                </div>

                <!-- Clients List -->
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div class="divide-y divide-gray-100" id="clients-list">
                        ${clients.length === 0 ? `
                            <div class="p-8 text-center text-gray-400">
                                <span class="material-symbols-outlined text-5xl mb-2">group</span>
                                <p>Aucun client enregistré</p>
                            </div>
                        ` : clients.map(client => `
                            <div class="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                                <div class="flex items-center gap-4">
                                    <div class="w-12 h-12 rounded-full ${client.type === 'VIP' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-500'} flex items-center justify-center font-bold">
                                        ${client.firstName ? client.firstName.charAt(0) : ''}${client.lastName ? client.lastName.charAt(0) : ''}
                                    </div>
                                    <div>
                                        <p class="font-bold text-gray-900">${client.firstName} ${client.lastName}</p>
                                        <p class="text-sm text-gray-500">${client.phone || 'Pas de téléphone'}</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-4">
                                    <div class="text-right hidden md:block">
                                        <p class="text-sm font-medium text-gray-900">${this.formatCurrency(client.totalSpent || 0)}</p>
                                        <span class="text-xs px-2 py-0.5 rounded-full ${client.type === 'VIP' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}">${client.type || 'Regular'}</span>
                                    </div>
                                    <button onclick="VendeuseApp.viewClientDetails('${client.id}')" 
                                        class="p-2 text-gray-400 hover:text-primary transition-colors">
                                        <span class="material-symbols-outlined">visibility</span>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    filterClients(term) {
        const clients = StorageHelper.getClients();
        const filtered = clients.filter(c =>
            (c.firstName + ' ' + c.lastName).toLowerCase().includes(term.toLowerCase()) ||
            (c.phone && c.phone.includes(term))
        );

        const container = document.getElementById('clients-list');
        if (!container) return;

        if (filtered.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-gray-400">Aucun client trouvé</div>`;
        } else {
            container.innerHTML = filtered.map(client => `
                <div class="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-full ${client.type === 'VIP' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-500'} flex items-center justify-center font-bold">
                            ${client.firstName ? client.firstName.charAt(0) : ''}${client.lastName ? client.lastName.charAt(0) : ''}
                        </div>
                        <div>
                            <p class="font-bold text-gray-900">${client.firstName} ${client.lastName}</p>
                            <p class="text-sm text-gray-500">${client.phone || 'Pas de téléphone'}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <div class="text-right hidden md:block">
                            <p class="text-sm font-medium text-gray-900">${this.formatCurrency(client.totalSpent || 0)}</p>
                            <span class="text-xs px-2 py-0.5 rounded-full ${client.type === 'VIP' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}">${client.type || 'Regular'}</span>
                        </div>
                        <button onclick="VendeuseApp.viewClientDetails('${client.id}')" 
                            class="p-2 text-gray-400 hover:text-primary transition-colors">
                            <span class="material-symbols-outlined">visibility</span>
                        </button>
                    </div>
                </div>
            `).join('');
        }
    },

    openNewClientModal() {
        document.getElementById('new-client-firstname').value = '';
        document.getElementById('new-client-lastname').value = '';
        document.getElementById('new-client-whatsapp').value = '';
        document.getElementById('new-client-modal').classList.remove('hidden');
    },

    saveNewClient(event) {
        event.preventDefault();
        const firstname = document.getElementById('new-client-firstname').value.trim();
        const lastname = document.getElementById('new-client-lastname').value.trim();
        const whatsapp = document.getElementById('new-client-whatsapp').value.trim();

        if (!firstname || !lastname || !whatsapp) {
            alert('Veuillez remplir tous les champs');
            return;
        }

        const newClient = {
            id: 'CLIENT_' + Date.now(),
            firstName: firstname,
            lastName: lastname,
            name: `${firstname} ${lastname}`, // Helper for search
            phone: whatsapp,
            whatsapp: whatsapp,
            type: 'Client',
            createdBy: this.currentUser.id,
            createdAt: new Date().toISOString(),
            totalSpent: 0,
            purchaseCount: 0
        };

        StorageHelper.addClient(newClient);

        document.getElementById('new-client-modal').classList.add('hidden');
        alert('Client créé avec succès !');

        // Refresh view if on clients view
        if (!document.getElementById('view-clients').classList.contains('hidden')) {
            this.loadClientsView();
        }
    },

    async viewClientDetails(clientId) {
        const clients = StorageHelper.getClients();
        const client = clients.find(c => c.id === clientId);
        if (!client) return;

        // Fetch sales for this client
        const allSales = await StorageHelper.getSales();
        const clientSales = allSales.filter(s => s.clientId === clientId || s.clienteId === clientId);

        // Calculate stats
        const totalSpent = clientSales.reduce((sum, s) => sum + s.total, 0);
        const count = clientSales.length;

        // Update UI
        document.getElementById('detail-client-name').textContent = `${client.firstName} ${client.lastName}`;
        document.getElementById('detail-client-phone').textContent = client.phone || client.whatsapp;
        document.getElementById('detail-client-total').textContent = this.formatCurrency(totalSpent);
        document.getElementById('detail-client-count').textContent = count;

        const historyContainer = document.getElementById('detail-client-history');
        if (clientSales.length === 0) {
            historyContainer.innerHTML = '<div class="p-4 text-center text-gray-400">Aucun achat historique</div>';
        } else {
            historyContainer.innerHTML = clientSales.slice().reverse().map(sale => `
                <div class="p-4 hover:bg-white transition-colors">
                    <div class="flex justify-between items-start mb-1">
                        <div>
                            <p class="font-bold text-gray-900 text-sm">${new Date(sale.date).toLocaleDateString()} at ${new Date(sale.date).toLocaleTimeString()}</p>
                            <p class="text-xs text-gray-500">${sale.items.length} articles</p>
                        </div>
                        <span class="font-bold text-gray-900">${this.formatCurrency(sale.total)}</span>
                    </div>
                    <div class="text-xs text-gray-500 line-clamp-2">
                        ${sale.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                    </div>
                </div>
            `).join('');
        }

        document.getElementById('client-details-modal').classList.remove('hidden');
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
        // Variant Handling
        if (product.variants && product.variants.length > 0) {
            this.openVariantModal(product);
            return;
        }

        // Legacy/Simple Product Handling
        const existing = this.cart.find(item => item.id === product.id);

        if (existing) {
            if (existing.quantity < product.stock) {
                existing.quantity++;
            } else {
                alert('Stock insuffisant !');
                return;
            }
        } else {
            this.cart.push({ ...product, quantity: 1, isVariant: false });
        }

        this.renderCart();
    },

    openVariantModal(product) {
        const modal = document.getElementById('variant-modal');
        const container = document.getElementById('variant-options-container');
        document.getElementById('variant-modal-title').textContent = product.name;

        container.innerHTML = product.variants.map(v => {
            const isOut = v.stock <= 0;
            return `
            <button onclick="${isOut ? '' : `POS.addVariantToCart('${product.id}', '${v.id}')`}" 
                class="w-full text-left p-4 rounded-xl border-2 transition-all flex justify-between items-center ${isOut ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed' : 'border-gray-100 hover:border-primary hover:bg-blue-50 bg-white'}"
            >
                <div>
                    <span class="font-bold text-gray-900">${v.size}</span>
                    <span class="text-gray-500 mx-2">•</span>
                    <span class="text-gray-700">${v.color}</span>
                </div>
                <div class="text-xs font-bold ${isOut ? 'text-red-500' : 'text-green-600 bg-green-100 px-2 py-1 rounded'}">
                    ${isOut ? 'Rupture' : `Stock: ${v.stock}`}
                </div>
            </button>
            `;
        }).join('');

        modal.classList.remove('hidden');
    },

    addVariantToCart(productId, variantId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        const variant = product.variants.find(v => v.id === variantId);
        if (!variant) return;

        // Check stock
        const existing = this.cart.find(item => item.id === product.id && item.variantId === variantId);

        if (existing) {
            if (existing.quantity < variant.stock) {
                existing.quantity++;
            } else {
                alert('Stock variant insuffisant !');
                return;
            }
        } else {
            this.cart.push({
                ...product,
                variantId: variant.id,
                variantName: `${variant.size} - ${variant.color}`,
                price: product.price, // Variants share price for now
                quantity: 1,
                maxStock: variant.stock,
                isVariant: true
            });
        }

        document.getElementById('variant-modal').classList.add('hidden');
        this.renderCart();
    },

    removeFromCart(index) {
        this.cart.splice(index, 1);
        this.renderCart();
    },

    updateQuantity(index, delta) {
        const item = this.cart[index];
        const newQty = item.quantity + delta;
        const limit = item.isVariant ? item.maxStock : item.stock;

        if (newQty <= 0) {
            this.removeFromCart(index);
        } else if (newQty > limit) {
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
                // Display variant info if exists
                const badge = item.isVariant ? `<span class="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded ml-1">${item.variantName}</span>` : '';

                row.innerHTML = `
                    <img src="${item.image}" class="w-12 h-12 rounded-lg object-cover border border-gray-200">
                    <div class="flex-1 min-w-0">
                        <h5 class="text-sm font-bold text-gray-900 line-clamp-1">${item.name} ${badge}</h5>
                        <p class="text-xs text-gray-500">${VendeuseApp.formatCurrency(item.price)} / unit</p>
                    </div>
                    <div class="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                        <button onclick="POS.updateQuantity(${index}, -1)" class="w-6 h-6 flex items-center justify-center rounded bg-white shadow-sm hover:text-red-500 text-gray-600">-</button>
                        <span class="text-sm font-bold w-4 text-center">${item.quantity}</span>
                        <button onclick="POS.updateQuantity(${index}, 1)" class="w-6 h-6 flex items-center justify-center rounded bg-white shadow-sm hover:text-green-500 text-gray-600">+</button>
                    </div>
                    <div class="text-right min-w-[60px]">
                        <div class="text-sm font-bold text-gray-900">${VendeuseApp.formatCurrency(item.price * item.quantity)}</div>
                        <div class="text-[10px] text-gray-400">Total</div>
                    </div>
                `;
                container.appendChild(row);
            });
        }

        this.updateTotals();
    },

    updateTotals() {
        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const taxRate = 0; // Simple for now
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
            alert('Le panier est vide');
            return;
        }

        const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Stock Check & Deduction
        const products = StorageHelper.getProducts();
        let stockIssue = false;

        const saleItems = this.cart.map(item => {
            const product = products.find(p => p.id === item.id);
            if (!product) {
                stockIssue = true;
                return;
            }

            if (item.isVariant) {
                const variant = product.variants.find(v => v.id === item.variantId);
                if (!variant || variant.stock < item.quantity) {
                    stockIssue = true;
                } else {
                    variant.stock -= item.quantity;
                    // Also decrement total stock for easy viewing
                    product.stock = (product.stock || 0) - item.quantity;
                }
            } else {
                if (product.stock < item.quantity) {
                    stockIssue = true;
                } else {
                    product.stock -= item.quantity;
                }
            }
            StorageHelper.updateProduct(product);

            return {
                id: item.id,
                name: item.name + (item.variantName ? ` (${item.variantName})` : ''),
                quantity: item.quantity,
                price: item.price,
                total: item.price * item.quantity,
                variantId: item.variantId || null
            };
        });

        if (stockIssue) {
            alert("Erreur de stock lors de la finalisation. Veuillez rafraîchir.");
            return;
        }

        const sale = {
            id: 'SALE_' + Date.now(),
            date: new Date().toISOString(),
            items: saleItems,
            total: total,
            paymentMethod: this.paymentMethod,
            vendeuseId: this.currentUser.id,
            vendeuseName: this.currentUser.name,
            clientId: this.currentClient ? this.currentClient.id : null,
            clientName: this.currentClient ? this.currentClient.name : 'Client invité'
        };

        const success = await StorageHelper.addSale(sale);

        if (success) {
            // Update cash register
            const cashReg = StorageHelper.getCashRegister();
            if (cashReg && cashReg.status === 'open') {
                cashReg.salesTotal += total;
                cashReg.currentAmount += total;
                StorageHelper.updateCashRegister(cashReg);
            }

            // Update client stats if exists
            if (this.currentClient && this.currentClient.id) {
                const client = StorageHelper.getClients().find(c => c.id === this.currentClient.id);
                if (client) {
                    client.totalSpent = (client.totalSpent || 0) + total;
                    client.purchaseCount = (client.purchaseCount || 0) + 1;
                    client.lastVisit = new Date().toISOString();
                    StorageHelper.updateClient(client);
                }
            }

            // Success UI
            alert('Vente réussie !');
            this.cart = [];
            this.currentClient = null;
            this.selectClient({ name: 'Client invité', id: null });
            this.renderCart();
            // Re-fetch products to get updated stock
            this.products = StorageHelper.getProducts();
            this.renderProducts();

            // Refresh history
            VendeuseApp.loadHistory();
        } else {
            alert('Erreur lors de l\'enregistrement de la vente');
        }
    }
};

// Start
window.addEventListener('load', () => {
    VendeuseApp.init();
});
