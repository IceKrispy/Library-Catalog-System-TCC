const { createClient } = require('@supabase/supabase-js');

let cachedClient = null;

function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY));
}

function getSupabase() {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    const error = new Error('Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_ANON_KEY in backend/.env or in your deployment environment variables.');
    error.status = 500;
    throw error;
  }

  cachedClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return cachedClient;
}

const supabase = new Proxy({}, {
  get(_target, property) {
    return getSupabase()[property];
  }
});

module.exports = {
  supabase,
  getSupabase,
  hasSupabaseConfig
};
