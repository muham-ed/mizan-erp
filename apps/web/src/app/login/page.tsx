'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [tenantSlug, setTenantSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:4000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'فشل تسجيل الدخول. تحقق من البيانات.');
      }

      const data = await res.json();
      localStorage.setItem('mizan_access_token', data.accessToken);
      localStorage.setItem('mizan_refresh_token', data.refreshToken);

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-slate-950">
      <div className="w-full max-w-md p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">تسجيل الدخول — ميزان</h2>
          <p className="text-sm text-slate-400">أدخل معرّف الشركة والبريد الإلكتروني للوصول لنظامك</p>
        </div>

        {error && (
          <div className="p-3 mb-6 text-sm text-red-400 bg-red-950/60 border border-red-800/80 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              معرّف الشركة (Tenant Slug)
            </label>
            <input
              type="text"
              required
              placeholder="مثال: acme"
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors dir-ltr text-right"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              required
              placeholder="admin@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors dir-ltr text-right"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              كلمة المرور
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors dir-ltr text-right"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-sky-600/30 disabled:opacity-50"
          >
            {loading ? 'جاري التحقق...' : 'دخول النظام'}
          </button>
        </form>
      </div>
    </div>
  );
}
