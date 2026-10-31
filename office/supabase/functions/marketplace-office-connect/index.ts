import { createClient } from "npm:@supabase/supabase-js@2.112.1";
import { createConnectHandler } from "./core.mjs";

const SOURCE_URL = "https://avenejzzakocgmoszlto.supabase.co";
const SOURCE_PUBLISHABLE_KEY = "sb_publishable_j-gjPSu69QkWrjBPkm4Uxg_dzHXEuQF";
const OFFICE_URL = "https://qkwfulonscvreudtroaw.supabase.co";
const officeUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

// These service credentials stay inside the Office Edge runtime. No source
// service credential or browser-supplied URL, user ID or tenant is accepted.
const handler = officeUrl === OFFICE_URL && serviceKey.length > 20
  ? createConnectHandler({
    office: createClient(officeUrl, serviceKey, { auth: authOptions }),
    createSourceClient(token: string) {
      return createClient(SOURCE_URL, SOURCE_PUBLISHABLE_KEY, {
        auth: authOptions,
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
    },
  })
  : () => new Response(JSON.stringify({ code: "service_unavailable", error: "service_unavailable" }), {
    status: 503,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

// The gateway must use verify_jwt=false because authorize verifies the other
// project's token itself, and exchange verifies its one-time PKCE credential.
Deno.serve(handler);
