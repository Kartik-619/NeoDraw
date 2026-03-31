const { PrismaClient } = require('@prisma/client');
const { config } = require('dotenv');
const { resolve } = require('path');

// Load .env from root
config({ path: resolve(__dirname, '.env') });

console.log('=== Testing NeonDB Connection ===');
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  console.log('Please create .env file in root with your NeonDB connection string');
  process.exit(1);
}

// Create Prisma client with explicit connection
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function test() {
  try {
    console.log('\n📡 Attempting to connect to NeonDB...');
    await prisma.$connect();
    console.log('✅ Successfully connected to NeonDB!');
    
    // Test query
    console.log('\n📊 Running test queries...');
    const userCount = await prisma.user.count();
    console.log(`✅ User count: ${userCount}`);
    
    // Get database time
    const result = await prisma.$queryRaw`SELECT NOW() as current_time`;
    console.log('✅ Database time:', result[0].current_time);
    
    await prisma.$disconnect();
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('P1001')) {
      console.log('\n💡 Troubleshooting:');
      console.log('1. Check your internet connection');
      console.log('2. Verify your IP is allowed in NeonDB settings');
      console.log('3. Make sure the database URL is correct');
      console.log('4. Try using the direct connection (without -pooler)');
    } else if (error.message.includes('authentication')) {
      console.log('\n💡 Authentication failed:');
      console.log('1. Check username and password in DATABASE_URL');
      console.log('2. Verify the database name is correct');
    } else if (error.message.includes('ENOTFOUND')) {
      console.log('\n💡 Host not found:');
      console.log('1. Check the hostname in your DATABASE_URL');
      console.log('2. Make sure the instance is active in NeonDB');
    }
  }
}

test();