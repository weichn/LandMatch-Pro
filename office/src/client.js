import { createClient } from '@supabase/supabase-js';
// Publishable key only. All data access is protected by tenant RLS.
export const db = createClient('https://qkwfulonscvreudtroaw.supabase.co', 'sb_publishable_lQ8iwMquVX8rz7fnQdlpZg_fgNQbwbO', { auth: { storageKey: 'landmatch-office-auth-v1', detectSessionInUrl: false } });

