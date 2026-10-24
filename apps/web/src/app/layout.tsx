import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ميزان ERP — Mizan ERP',
  description: 'نظام إدارة الشركات والمخازن للشركات الصغيرة والمتوسطة',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-['Cairo',sans-serif] bg-slate-900 text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
