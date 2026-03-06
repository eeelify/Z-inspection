import React, { useState } from 'react';
import { api } from '../api';

interface ForgotPasswordProps {
    onBackToLogin: () => void;
}

export function ForgotPassword({ onBackToLogin }: ForgotPasswordProps) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            setError('Please enter your email address.');
            return;
        }

        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const response = await fetch(api('/api/forgot-password'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                setMessage(data.message || 'A password reset link has been sent to your email.');
                setEmail('');
            } else {
                setError(data.message || 'An error occurred.');
            }
        } catch (err) {
            console.error('Forgot password error:', err);
            setError('Could not connect to the server.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex">
            <div className="w-full flex flex-col justify-center px-12 bg-white lg:w-1/2 mx-auto">
                <div className="max-w-md mx-auto w-full">
                    <div className="mb-8">
                        <h1 className="text-4xl mb-2 text-gray-900 font-black tracking-tight" style={{ fontWeight: 900, fontFamily: 'Inter, sans-serif' }}>Ethical AI Analysis Platform</h1>
                        <p className="text-xl text-gray-900 font-medium">Forgot Password</p>
                    </div>

                    <div className="mb-6">
                        <p className="text-base text-gray-900">
                            Enter the email address associated with your account to reset your password. We will send you a reset link.
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-base">
                            {error}
                        </div>
                    )}
                    {message && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-base">
                            {message}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm mb-2 text-gray-700 font-semibold">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 h-12 text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 box-border"
                                placeholder="Enter your email address"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 rounded-lg text-white transition-colors hover:opacity-90 cursor-pointer font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600"
                        >
                            {loading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={onBackToLogin}
                            className="w-full py-2.5 px-4 text-gray-600 hover:text-gray-800 text-base"
                        >
                            ← Back to login
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
