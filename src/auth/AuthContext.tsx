import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, setSentinelApiAuth } from '../../services/apiService';

interface AuthState {
    isAuthenticated: boolean;
    isLoading: boolean;
}

interface AuthContextValue extends AuthState {
    accessToken: string | null;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const accessTokenRef = useRef<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    // Wire up sentinelApi auth injection
    setSentinelApiAuth(
        () => accessTokenRef.current,
        () => { logout(); },
    );

    // On mount, attempt silent refresh to restore session
    useEffect(() => {
        authApi.refresh()
            .then((res) => {
                accessTokenRef.current = res.access_token;
                setIsAuthenticated(true);
            })
            .catch(() => {
                accessTokenRef.current = null;
                setIsAuthenticated(false);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, []);

    const login = async (username: string, password: string): Promise<void> => {
        const res = await authApi.login(username, password);
        accessTokenRef.current = res.access_token;
        setIsAuthenticated(true);
    };

    const logout = async (): Promise<void> => {
        accessTokenRef.current = null;
        setIsAuthenticated(false);
        try {
            await authApi.logout();
        } catch {
            // Ignore logout API errors — session is already cleared locally
        }
        navigate('/login');
    };

    const getAccessToken = (): string | null => accessTokenRef.current;

    return (
        <AuthContext.Provider
            value={{
                accessToken: accessTokenRef.current,
                isAuthenticated,
                isLoading,
                login,
                logout,
                getAccessToken,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return ctx;
}

export { AuthContext };
