import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <div className="inline-block px-4 py-1.5 mb-6 text-xs font-semibold tracking-wide text-sky-400 uppercase bg-sky-950 border border-sky-800 rounded-full">
        Mizan ERP — نظام ميزان السحابي
      </div>
      <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-6">
        إدارة الحسابات والمخازن <br />
        <span className="text-sky-500">ببساطة وأمان مطلق</span>
      </h1>
      <p className="max-w-2xl text-slate-400 text-lg mb-8 leading-relaxed">
        نظام ERP سحابي صُمم خصيصاً للشركات والمحلات في مصر والشرق الأوسط.
        عزل كامل لبيانات كل شركة، دعم الفاتورة الإلكترونية، والذكاء الاصطناعي.
      </p>

      <div className="flex flex-wrap gap-4 justify-center">
        <Link
          href="/login"
          className="px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-sky-600/30"
        >
          تسجيل الدخول للنظام
        </Link>
        <Link
          href="/dashboard"
          className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded-lg transition-colors"
        >
          معاينة لوحة التحكم
        </Link>
      </div>
    </div>
  );
}
