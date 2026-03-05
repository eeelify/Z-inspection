import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface ResetPasswordProps {
    onBackToLogin: () => void;
}

export function ResetPassword({ onBackToLogin }: ResetPasswordProps) {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Extract token from URL search params
        const searchParams = new URLSearchParams(window.location.search);
        const tokenParam = searchParams.get('token');

        if (tokenParam) {
            setToken(tokenParam);
        } else {
            setError('Invalid or missing token. Please try again using the link in your email.');
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!token) {
            setError('Token not found. Please check the link in your email.');
            return;
        }

        if (!newPassword || !confirmPassword) {
            setError('Please fill in all fields.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const response = await fetch(api('/api/reset-password'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword })
            });

            const data = await response.json();

            if (response.ok) {
                setMessage('Your password has been successfully updated. You can now login.');
                setNewPassword('');
                setConfirmPassword('');
                // Optional: wait a moment and then call onBackToLogin automatically
                setTimeout(() => {
                    onBackToLogin();
                }, 3000);
            } else {
                setError(data.message || 'An error occurred.');
            }
        } catch (err) {
            console.error('Reset password error:', err);
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
                        <h1 className="text-4xl mb-2 text-gray-900 font-black tracking-tight" style={{ fontWeight: 900, fontFamily: 'Inter, sans-serif' }}>Z-Inspection Platform</h1>
                        <p className="text-xl text-gray-900 font-medium">Set New Password</p>
                    </div>

                    <div className="mb-6">
                        <p className="text-base text-gray-900">
                            Please set a new password for your account.
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

                    {!message && token && (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm mb-2 text-gray-700 font-semibold">New Password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 h-12 text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 box-border"
                                    placeholder="Enter your new password"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm mb-2 text-gray-700 font-semibold">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 h-12 text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 box-border"
                                    placeholder="Confirm your new password"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 px-4 rounded-lg text-white transition-colors hover:opacity-90 cursor-pointer font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600"
                            >
                                {loading ? 'Updating...' : 'Update Password'}
                            </button>
                        </form>
                    )}

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
