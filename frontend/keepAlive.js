// keepAlive.js
// Menggunakan native fetch (tersedia di Node.js v18+)

// Mengambil konfigurasi dari environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://rnahdxukfyzifvsbhndu.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuYWhkeHVrZnl6aWZ2c2JobmR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODU1NDcsImV4cCI6MjA4NjA2MTU0N30.nV7d-xNXMMkiailEQV_OVmZ9cCy1q_e5QFuaC9DARvw';

// Perbaikan: Menggunakan endpoint Health Check Auth yang lebih stabil dan tidak memicu RLS (menghindari error 500 recursion)
const PING_URL = `${SUPABASE_URL}/auth/v1/health`;
const AI_PING_URL = `${SUPABASE_URL}/functions/v1/ai-tutor`;
const INTERVAL = 4 * 60 * 1000; // 4 menit

console.log('🚀 Keep-alive script started. Pinging Supabase every 4 minutes...');
console.log(`📡 Target URL: ${SUPABASE_URL}`);

function pingSupabase() {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  };

  // 1. Ping Auth Health (Paling stabil untuk mengecek apakah instance aktif)
  fetch(PING_URL, { method: 'GET', headers: headers })
    .then(res => {
        if (res.ok) {
            console.log(`✅ [${new Date().toLocaleTimeString()}] DB Ping: ${res.status} (Healthy)`);
        } else {
            console.error(`⚠️ [${new Date().toLocaleTimeString()}] DB Ping: ${res.status}`);
        }
    })
    .catch(err => console.error(`❌ DB Ping failed:`, err.message));

  // 2. Wake up AI Function
  fetch(AI_PING_URL, {
    method: 'OPTIONS',
    headers: { ...headers, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
  })
    .then(res => console.log(`🤖 [${new Date().toLocaleTimeString()}] AI Wake-up: ${res.status}`))
    .catch(err => console.error(`❌ AI Wake-up failed:`, err.message));
}

// Ping pertama saat dijalankan
pingSupabase();

// Interval selanjutnya
setInterval(() => {
  pingSupabase();
}, INTERVAL);

console.log('✨ Keep-alive script initialized successfully!');
