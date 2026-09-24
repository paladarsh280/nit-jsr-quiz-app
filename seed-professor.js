const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

// Setup Prisma with the Edge-compatible pg adapter
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.ldndzmwcahhwexfcjajp:Nitjsr%40%232025@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seed() {
  try {
    const emailsToSeed = ['paladarsh593@gmail.com', 'mvi@nitjsr.ac.in', 'unnamedutopia@gmail.com'];
    for (const email of emailsToSeed) {
      await prisma.user.upsert({
        where: { email },
        update: { role: 'PROFESSOR' },
        create: {
          email,
          name: email.split('@')[0],
          role: 'PROFESSOR',
        }
      });
      console.log(`Successfully seeded ${email} as PROFESSOR`);
    }
  } catch (e) {
    console.error('Seeding failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
