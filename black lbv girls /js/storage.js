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
  }
};

const INITIAL_PRODUCTS = [
  {
    id: 'PROD_001',
    name: 'Nike Air Max 270',
    sku: 'NIK-270-RED-42',
    category: 'Chaussures',
    price: 120000, // Updated to typical FCFA amounts
    stock: 12,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=300&h=300',
    status: 'active'
  },
  {
    id: 'PROD_002',
    name: 'Adidas Ultraboost',
    sku: 'ADI-ULT-BLK-42',
    category: 'Chaussures',
    price: 180000,
    stock: 8,
    image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&q=80&w=300&h=300',
    status: 'active'
  },
  {
    id: 'PROD_003',
    name: 'T-Shirt Cotton Basic',
    sku: 'TSH-WHT-M',
    category: 'Vêtements',
    price: 15000,
    stock: 50,
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=300&h=300',
    status: 'active'
  },
  {
    id: 'PROD_004',
    name: 'Jean Slim Fit',
    sku: 'JEA-BLU-32',
    category: 'Vêtements',
    price: 35000,
    stock: 20,
    image: 'https://images.unsplash.com/photo-1542272454315-4c01d7abdf4a?auto=format&fit=crop&q=80&w=300&h=300',
    status: 'active'
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
