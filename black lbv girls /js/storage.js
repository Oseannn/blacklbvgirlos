/**
 * RetailOS - Storage Management
 * Handles data persistence using window.localStorage
 */

// Initial Data Seeding
const INITIAL_USERS = {
  admin: {
    email: 'admin@store.com',
    password: 'admin123',
    role: 'admin',
    name: 'Administrateur',
    id: 'admin_001',
    avatar: 'https://ui-avatars.com/api/?name=Admin&background=137fec&color=fff'
  },
  vendeuse1: {
    email: 'sarah@store.com',
    password: 'vendeuse123',
    role: 'vendeuse',
    name: 'Sarah Jenkins',
    id: 'v_001',
    avatar: 'https://ui-avatars.com/api/?name=Sarah+Jenkins&background=random'
  },
  vendeuse2: {
    email: 'marie@store.com',
    password: 'vendeuse123',
    role: 'vendeuse',
    name: 'Marie Dupont',
    id: 'v_002',
    avatar: 'https://ui-avatars.com/api/?name=Marie+Dupont&background=random'
  },
  manager: {
    email: 'manager@store.com',
    password: 'manager123',
    role: 'manager',
    name: 'Sophie Manager',
    id: 'mgr_001',
    avatar: 'https://ui-avatars.com/api/?name=Sophie+Manager&background=random'
  }
};

const INITIAL_PRODUCTS = [
  {
    id: 'PROD_001',
    name: 'Nike Air Max 270',
    sku: 'NIK-270-RED',
    brand: 'Nike',
    category: 'Chaussures',
    price: 120000,
    active: true,
    variants: [
      { id: 'v_n_1', size: '42', color: 'Rouge', stock: 5 },
      { id: 'v_n_2', size: '43', color: 'Rouge', stock: 3 },
      { id: 'v_n_3', size: '42', color: 'Noir', stock: 4 }
    ],
    stock: 12, // Legacy fallback
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=300&h=300'
  },
  {
    id: 'PROD_002',
    name: 'Adidas Ultraboost',
    sku: 'ADI-ULT-BLK',
    brand: 'Adidas',
    category: 'Chaussures',
    price: 180000,
    active: true,
    variants: [
      { id: 'v_a_1', size: '42', color: 'Noir', stock: 8 }
    ],
    stock: 8,
    image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&q=80&w=300&h=300'
  },
  {
    id: 'PROD_003',
    name: 'T-Shirt Cotton Basic',
    sku: 'TSH-WHT',
    brand: 'Uniqlo',
    category: 'Vêtements',
    price: 15000,
    active: true,
    variants: [
      { id: 'v_t_1', size: 'M', color: 'Blanc', stock: 20 },
      { id: 'v_t_2', size: 'L', color: 'Blanc', stock: 15 },
      { id: 'v_t_3', size: 'S', color: 'Blanc', stock: 15 }
    ],
    stock: 50,
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=300&h=300'
  }
];

const INITIAL_CLIENTS = [
  {
    id: 'CLIENT_001',
    firstName: 'Marie',
    lastName: 'Dubois',
    phone: '+33612345678',
    email: 'marie.d@email.com',
    type: 'VIP',
    createdBy: 'v_001',
    createdAt: '2024-01-01T10:00:00Z',
    notes: 'Préfère les baskets Nike',
    totalSpent: 1250000,
    lastVisit: '2024-01-15T14:30:00Z'
  },
  {
    id: 'CLIENT_002',
    firstName: 'Sophie',
    lastName: 'Martin',
    phone: '+33698765432',
    email: 'sophie.m@email.com',
    type: 'Regular',
    createdBy: 'v_002',
    createdAt: '2024-02-10T11:20:00Z',
    notes: '',
    totalSpent: 320000,
    lastVisit: '2024-02-28T16:15:00Z'
  }
];

// Define objects and immediately expose them to window
const Storage = {
  get(key) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error('LocalStorage access error:', e);
      return null;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('LocalStorage write error:', e);
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('LocalStorage remove error:', e);
    }
  },

  // Initialize store if empty
  init() {
    if (!this.get('users') || Object.keys(this.get('users')).length === 0) {
      console.log('Seeding initial users...');
      this.set('users', INITIAL_USERS);
    }
    if (!this.get('products')) {
      this.set('products', INITIAL_PRODUCTS);
    }
    if (!this.get('clients')) {
      this.set('clients', INITIAL_CLIENTS);
    }
    if (!this.get('sales')) {
      this.set('sales', []);
    }
  }
};
window.Storage = Storage;

const StorageHelper = {
  // USERS
  getUsers() {
    return Storage.get('users') || INITIAL_USERS;
  },

  getUserByEmail(email) {
    const users = this.getUsers();
    if (!users) return null;
    return Object.values(users).find(u => u.email === email);
  },

  // SALES
  async getSales() {
    return Storage.get('sales') || [];
  },

  async addSale(saleData) {
    try {
      const sales = await this.getSales();
      sales.push(saleData);
      Storage.set('sales', sales);
      return true;
    } catch (error) {
      console.error('Error adding sale:', error);
      return false;
    }
  },

  async getSalesByVendeuse(vendeuseId) {
    const allSales = await this.getSales();
    return allSales.filter(sale => sale.vendeuseId === vendeuseId);
  },

  // CLIENTS
  getClients() {
    return Storage.get('clients') || [];
  },

  addClient(clientData) {
    const clients = this.getClients();
    clients.push(clientData);
    Storage.set('clients', clients);
  },

  updateClient(updatedClient) {
    const clients = this.getClients();
    const index = clients.findIndex(c => c.id === updatedClient.id);
    if (index !== -1) {
      clients[index] = updatedClient;
      Storage.set('clients', clients);
    }
  },

  // PRODUCTS
  getProducts() {
    return Storage.get('products') || [];
  },

  addProduct(product) {
    const products = this.getProducts();
    products.push(product);
    Storage.set('products', products);
    return product;
  },

  updateProduct(product) {
    const products = this.getProducts();
    const index = products.findIndex(p => p.id === product.id);
    if (index !== -1) {
      products[index] = product;
      Storage.set('products', products);
      return true;
    }
    return false;
  },

  deleteProduct(productId) {
    const products = this.getProducts();
    const newProducts = products.filter(p => p.id !== productId);
    Storage.set('products', newProducts);
  },

  // CASH REGISTER MANAGEMENT
  getCashRegister() {
    return Storage.get('cashRegister') || null;
  },

  openCashRegister(initialAmount, userId, userName) {
    const cashRegister = {
      id: 'CASH_' + Date.now(),
      status: 'open',
      openedAt: new Date().toISOString(),
      openedBy: userId,
      openedByName: userName,
      initialAmount: initialAmount,
      currentAmount: initialAmount,
      salesTotal: 0,
      withdrawals: [],
      closedAt: null,
      closedBy: null,
      expectedAmount: 0,
      finalAmount: 0,
      difference: 0
    };
    Storage.set('cashRegister', cashRegister);

    // Add to history
    const history = this.getCashHistory();
    history.push({ ...cashRegister, type: 'open' });
    Storage.set('cashHistory', history);

    return cashRegister;
  },

  addCashWithdrawal(amount, reason, userId, userName) {
    const cashRegister = this.getCashRegister();
    if (!cashRegister || cashRegister.status !== 'open') {
      return { success: false, message: 'La caisse n\'est pas ouverte' };
    }

    const withdrawal = {
      id: 'WD_' + Date.now(),
      amount: amount,
      reason: reason,
      userId: userId,
      userName: userName,
      date: new Date().toISOString()
    };

    cashRegister.withdrawals.push(withdrawal);
    cashRegister.currentAmount -= amount;
    Storage.set('cashRegister', cashRegister);

    return { success: true, withdrawal };
  },

  closeCashRegister(finalAmount, userId, userName) {
    const cashRegister = this.getCashRegister();
    if (!cashRegister || cashRegister.status !== 'open') {
      return { success: false, message: 'La caisse n\'est pas ouverte' };
    }

    // Calculate expected amount
    const withdrawalsTotal = cashRegister.withdrawals.reduce((sum, w) => sum + w.amount, 0);
    const expectedAmount = cashRegister.initialAmount + cashRegister.salesTotal - withdrawalsTotal;
    const difference = finalAmount - expectedAmount;

    cashRegister.status = 'closed';
    cashRegister.closedAt = new Date().toISOString();
    cashRegister.closedBy = userId;
    cashRegister.closedByName = userName;
    cashRegister.expectedAmount = expectedAmount;
    cashRegister.finalAmount = finalAmount;
    cashRegister.difference = difference;

    // Add to history
    const history = this.getCashHistory();
    history.push({ ...cashRegister, type: 'close' });
    Storage.set('cashHistory', history);

    // Clear current register
    Storage.remove('cashRegister');

    return { success: true, cashRegister };
  },

  updateCashSales(saleTotal) {
    const cashRegister = this.getCashRegister();
    if (cashRegister && cashRegister.status === 'open') {
      cashRegister.salesTotal += saleTotal;
      cashRegister.currentAmount += saleTotal;
      Storage.set('cashRegister', cashRegister);
    }
  },

  getCashHistory() {
    return Storage.get('cashHistory') || [];
  },

  // AUTH
  getCurrentUser() {
    return Storage.get('currentUser');
  },

  setCurrentUser(user) {
    Storage.set('currentUser', user);
  },

  logout() {
    Storage.remove('currentUser');
  },

  // RESET
  resetDatabase() {
    console.log('Resetting database...');
    localStorage.clear();
    Storage.init();
    console.log('Database reset complete.');
    return true;
  }
};
window.StorageHelper = StorageHelper;

// Initialize on load
try {
  Storage.init();
  console.log('RetailOS Storage initialized.');
} catch (e) {
  console.error('Failed to initialize storage:', e);
}
