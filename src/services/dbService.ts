const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export interface User {
    id: string;
    email: string;
    displayName: string;
    streakCount: number;
    joinedAt: string;
}

export interface AuthResponse {
    user: User;
    token: string;
}

const getAuthHeaders = () => {
    const token = localStorage.getItem('bible_auth_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

export const dbService = {
    // Auth
    async signup(email: string, password: string, displayName?: string): Promise<AuthResponse> {
        const response = await fetch(`${API_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, displayName })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Signup failed');
        }
        return response.json();
    },

    async login(email: string, password: string): Promise<AuthResponse> {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Login failed');
        }
        return response.json();
    },

    // Data Sync
    async fetchUserData() {
        const response = await fetch(`${API_URL}/user/data`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error('Failed to fetch user data');
        return response.json();
    },

    async syncData(data: {
        notes?: any[];
        bookmarks?: any[];
        progress?: { activePlanId: string | null; completedChapters: Record<string, boolean> };
        highlights?: any[];
        gallery?: any[];
    }) {
        const response = await fetch(`${API_URL}/user/sync`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Sync failed');
        return response.json();
    }
};
