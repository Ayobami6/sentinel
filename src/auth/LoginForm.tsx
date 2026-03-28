import React, { useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from './AuthContext';

interface LoginFormState {
    username: string;
    password: string;
    isSubmitting: boolean;
    error: string | null;
}

const LoginForm: React.FC = () => {
    const { login } = useAuth();
    const [form, setForm] = useState<LoginFormState>({
        username: '',
        password: '',
        isSubmitting: false,
        error: null,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value, error: null }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const username = form.username.trim();
        const password = form.password.trim();

        if (!username || !password) {
            setForm(prev => ({ ...prev, error: 'Username and password are required.' }));
            return;
        }

        setForm(prev => ({ ...prev, isSubmitting: true, error: null }));

        try {
            await login(username, password);
        } catch (err: unknown) {
            // authApi.login throws Error with detail message from backend on 401,
            // or a generic message on network/5xx errors.
            const message = err instanceof Error && err.message
                ? err.message
                : 'Unable to connect. Please try again.';
            setForm(prev => ({ ...prev, isSubmitting: false, error: message }));
        }
    };

    return (
        <form onSubmit={handleSubmit} noValidate className="w-full space-y-5">
            <div className="flex flex-col items-center gap-2 mb-6">
                <div className="p-3 bg-blue-600/10 rounded-xl border border-blue-500/20">
                    <ShieldCheck size={28} className="text-blue-400" />
                </div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight">Sentinel</h1>
                <p className="text-slate-400 text-sm">Sign in to access your fleet dashboard</p>
            </div>

            <div className="space-y-1">
                <label htmlFor="username" className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Username
                </label>
                <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    value={form.username}
                    onChange={handleChange}
                    disabled={form.isSubmitting}
                    placeholder="Enter your username"
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50"
                />
            </div>

            <div className="space-y-1">
                <label htmlFor="password" className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Password
                </label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={form.password}
                    onChange={handleChange}
                    disabled={form.isSubmitting}
                    placeholder="Enter your password"
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50"
                />
            </div>

            {form.error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm px-4 py-2.5 rounded-lg">
                    {form.error}
                </div>
            )}

            <button
                type="submit"
                disabled={form.isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-lg transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
            >
                {form.isSubmitting ? (
                    <>
                        <RefreshCw size={16} className="animate-spin" />
                        Signing in...
                    </>
                ) : (
                    'Sign In'
                )}
            </button>
        </form>
    );
};

export default LoginForm;
