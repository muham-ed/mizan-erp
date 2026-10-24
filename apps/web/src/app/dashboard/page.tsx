'use client';

import { useState } from 'react';

export default function DashboardPage() {
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    setOcrResult(null);

    const token = localStorage.getItem('mizan_access_token');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:4000/api/v1/ai/ocr/invoice', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) throw new Error('فشل معالجة الفاتورة');

      const data = await res.json();
      setOcrResult(data);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ في قراءة الفاتورة بالذكاء الاصطناعي');
    } finally {
      setOcrLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-between">
        <div>
          <div className="text-xl font-extrabold text-sky-400 mb-8 tracking-wider">
            ميزان ERP
          </div>
          <nav className="space-y-2">
            <a href="#" className="flex items-center gap-3 px-4 py-2.5 bg-sky-950 text-sky-400 font-semibold rounded-lg border border-sky-800">
              📊 الرئيسية
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
              📦 المنتجات والمخزون
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
              📑 الفواتير والمبيعات
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
              👥 العملاء والموردين
            </a>
          </nav>
        </div>
        <div className="text-xs text-slate-500 text-center">
          Mizan ERP v1.0.0 — Multi-Tenant
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">لوحة التحكم الرئيسية</h1>
            <p className="text-sm text-slate-400">ملخص أداء الشركة والمخزون المباشر</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-3 py-1 rounded-full">
              عزل RLS نَشِط
            </span>
          </div>
        </header>

        {/* KPIs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-xs text-slate-400 font-medium mb-2">إجمالي المبيعات (الشهر)</div>
            <div className="text-2xl font-extrabold text-emerald-400">124,500 ج.م</div>
          </div>
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-xs text-slate-400 font-medium mb-2">الفواتير المكتملة</div>
            <div className="text-2xl font-extrabold text-sky-400">142 فاتورة</div>
          </div>
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-xs text-slate-400 font-medium mb-2">تنبيهات نواقص المخزون</div>
            <div className="text-2xl font-extrabold text-amber-400">3 منتجات</div>
          </div>
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-xs text-slate-400 font-medium mb-2">إجمالي عدد العملاء</div>
            <div className="text-2xl font-extrabold text-purple-400">89 عميل</div>
          </div>
        </div>

        {/* AI OCR Section */}
        <section className="p-6 bg-slate-900 border border-slate-800 rounded-xl mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">🤖 مساعد قراءة الفواتير بالذكاء الاصطناعي (AI OCR)</h2>
              <p className="text-xs text-slate-400">ارفع صورة فاتورة شراء ورقية لتفريغها آلياً واستخراج الأصناف</p>
            </div>
            <label className="cursor-pointer px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg transition-colors shadow-md shadow-sky-600/30">
              {ocrLoading ? 'جاري المعالجة...' : 'رفع فاتورة جديدة'}
              <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {ocrResult && (
            <div className="mt-6 p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3 text-sm">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">اسم المورد:</span>
                <span className="font-bold text-white">{ocrResult.vendorName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">رقم الفاتورة والضريبة:</span>
                <span className="text-sky-400 font-mono">{ocrResult.invoiceNumber} | {ocrResult.taxNumber}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">الإجمالي الشامل (14% ضريبة):</span>
                <span className="font-bold text-emerald-400">{ocrResult.totalAmount} {ocrResult.currency}</span>
              </div>
              <div className="pt-2">
                <div className="text-xs font-semibold text-slate-400 mb-2">الأصناف المستخرجة:</div>
                <ul className="space-y-1">
                  {ocrResult.lineItems?.map((item: any, idx: number) => (
                    <li key={idx} className="flex justify-between text-xs bg-slate-900 p-2 rounded">
                      <span>{item.description} ({item.quantity} قطعة)</span>
                      <span className="text-slate-300 font-mono">{item.totalPrice} EGP</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
