import React, { useState } from 'react';
import { ArrowLeft, Mail, Lock, User } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (email: string, password: string, role: string) => void;
}

const roleColors = {
  admin: '#1F2937',
  'ethical-expert': '#1E40AF', 
  'medical-expert': '#9D174D',
  'use-case-owner': '#065F46'
};

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<string>('admin');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      onLogin(email, password, role);
    } else {
      // Mock registration - in real app would create user
      alert('Registration successful! Please log in.');
      setIsLogin(true);
      setName('');
      setPassword('');
    }
  };

  const demoCredentials = [
    { role: 'admin', email: 'admin@zinspection.com', name: 'Admin User' },
    { role: 'ethical-expert', email: 'ethical@zinspection.com', name: 'Sarah Johnson' },
    { role: 'medical-expert', email: 'medical@zinspection.com', name: 'Dr. Emily Smith' },
    { role: 'use-case-owner', email: 'usecase@zinspection.com', name: 'John Davis' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Side - Form */}
      <div className="w-1/2 flex flex-col justify-center px-12 bg-white">
        <div className="max-w-md mx-auto w-full">
          <div className="mb-8">
            <h1 className="text-3xl mb-2 text-gray-900">Z-Inspection Platform</h1>
            <p className="text-gray-600">Ethical AI Evaluation System</p>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl mb-2">{isLogin ? 'Sign In' : 'Create Account'}</h2>
            <p className="text-gray-600">
              {isLogin ? 'Welcome back! Please sign in to continue.' : 'Join the ethical AI evaluation platform.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <div>
                <label className="block text-sm mb-2 text-gray-700">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your full name"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm mb-2 text-gray-700">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2 text-gray-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2 text-gray-700">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ color: roleColors[role as keyof typeof roleColors] }}
              >
                <option value="admin">Admin</option>
                <option value="ethical-expert">Ethical Expert</option>
                <option value="medical-expert">Medical Expert</option>
                <option value="use-case-owner">Use Case Owner</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-lg text-white transition-colors"
              style={{ backgroundColor: roleColors[role as keyof typeof roleColors] }}
            >
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-600 hover:underline"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>

          {isLogin && (
            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm mb-2 text-blue-900">Demo Credentials</h3>
              <div className="space-y-1 text-xs text-blue-800">
                {demoCredentials.map((cred) => (
                  <div key={cred.role} className="flex justify-between">
                    <span className="font-medium">{cred.role === 'ethical-expert' ? 'Ethical Expert' : cred.role === 'medical-expert' ? 'Medical Expert' : cred.role === 'use-case-owner' ? 'Use Case Owner' : 'Admin'}:</span>
                    <span>{cred.email}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-blue-700 mt-2">Password: any text</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Illustration/Welcome */}
      <div 
        className="w-1/2 flex flex-col justify-center items-center text-white px-12"
        style={{ backgroundColor: roleColors[role as keyof typeof roleColors] }}
      >
        <div className="text-center max-w-lg">
          <div className="text-6xl mb-6">🔍</div>
          <h2 className="text-3xl mb-4">Ethical AI Evaluation</h2>
          <p className="text-lg opacity-90 mb-6">
            Comprehensive platform for conducting Z-Inspection methodology on AI systems.
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <div className="text-2xl mb-1">📋</div>
              <div>Structured Evaluation</div>
            </div>
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <div className="text-2xl mb-1">👥</div>
              <div>Multi-Role Collaboration</div>
            </div>
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <div className="text-2xl mb-1">📊</div>
              <div>Claims Management</div>
            </div>
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <div className="text-2xl mb-1">📄</div>
              <div>Comprehensive Reports</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}