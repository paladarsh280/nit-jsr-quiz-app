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
    await prisma.user.upsert({
      where: { email: 'paladarsh593@gmail.com' },
      update: { role: 'PROFESSOR' },
      create: { 
        email: 'paladarsh593@gmail.com', 
        name: 'Adarsh (Testing Professor)', 
        role: 'PROFESSOR',
        image: 'https://lh3.googleusercontent.com/a/ACg8ocILMWn62nUeY5GRwNVDTGOndxlBy9lvOOB8XMm-PXts8F35oA=s96-c'
      }
    });
    console.log('Successfully seeded paladarsh593@gmail.com as PROFESSOR');
  } catch(e) {
    console.error('Seeding failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
