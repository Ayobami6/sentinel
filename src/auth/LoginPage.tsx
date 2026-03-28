import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import LoginForm from './LoginForm';

const LoginPage: React.FC = () => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) return null;
    if (isAuthenticated) return <Navigate to="/" replace />;

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-700/50 rounded-2xl p-8 shadow-2xl shadow-black/40">
                <LoginForm />
            </div>
        </div>
    );
};

export default LoginPage;
