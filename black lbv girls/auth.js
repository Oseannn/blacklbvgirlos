/**
 * RetailOS - Authentication Management
 */

const Auth = {
    login(email, password, role) {
        if (!window.StorageHelper) {
            console.error("StorageHelper not loaded.");
            return { success: false, message: 'Erreur système: Stockage non initialisé' };
        }

        const user = StorageHelper.getUserByEmail(email);

        if (!user) {
            return { success: false, message: 'Email introuvable' };
        }

        if (user.password !== password) {
            return { success: false, message: 'Mot de passe incorrect' };
        }

        if (user.role !== role) {
            return { success: false, message: `Ce compte n'a pas les droits ${role}` };
        }

        // Set session
        const sessionUser = { ...user, sessionStart: new Date().toISOString() };
        delete sessionUser.password; // Don't store password in session
        StorageHelper.setCurrentUser(sessionUser);

        return { success: true, user: sessionUser };
    },

    checkSession() {
        if (!window.StorageHelper) return null;
        const user = StorageHelper.getCurrentUser();
        if (!user) {
            window.location.href = 'index.html';
            return null;
        }
        return user;
    },

    requireRole(role) {
        const user = this.checkSession();
        if (user && user.role !== role) {
            // Redirect to correct dashboard based on role
            if (user.role === 'admin') window.location.href = 'admin_dashboard.html';
            else if (user.role === 'vendeuse') window.location.href = 'vendeuse_dashboard.html';
            return false;
        }
        return true;
    },

    logout() {
        if (window.StorageHelper) {
            StorageHelper.logout();
        }
        window.location.href = 'index.html';
    }
};

// Expose globally
window.Auth = Auth;
