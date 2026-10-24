import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding...');

  const plans = [
    { code: 'free',       name: 'Free',       nameAr: 'مجاني',   priceMonthly: 0,    priceYearly: 0,     maxUsers: 2,   maxProducts: 50,     maxInvoices: 30,    features: { ai: false, whatsapp: false, eta: false } },
    { code: 'basic',      name: 'Basic',      nameAr: 'أساسي',   priceMonthly: 299,  priceYearly: 2990,  maxUsers: 5,   maxProducts: 500,    maxInvoices: 300,   features: { ai: false, whatsapp: false, eta: true  } },
    { code: 'pro',        name: 'Pro',        nameAr: 'احترافي', priceMonthly: 799,  priceYearly: 7990,  maxUsers: 20,  maxProducts: 5000,   maxInvoices: 3000,  features: { ai: true,  whatsapp: true,  eta: true  } },
    { code: 'enterprise', name: 'Enterprise', nameAr: 'مؤسسي',   priceMonthly: 1999, priceYearly: 19990, maxUsers: 100, maxProducts: 100000, maxInvoices: 50000, features: { ai: true,  whatsapp: true,  eta: true, sso: true } },
  ];

  for (const p of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { code: p.code },
      update: { ...p, isActive: true },
      create: p,
    });
    console.log(`  ✓ plan: ${p.code}`);
  }

  console.log('✅ Seed done');
}

main()
  .catch((err) => { console.error('❌ Seed failed:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });