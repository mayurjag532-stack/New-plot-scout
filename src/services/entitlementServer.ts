import { getSession, refreshSession } from './auth';
import { backendConfigured, runtimeConfig } from './config';
export type ServerEntitlement={product_code:string;status:'active'|'expired'|'revoked';starts_at:string;ends_at:string|null;source:string};
async function headers(){let s=getSession();if(!s)return null;return {apikey:runtimeConfig.supabaseAnonKey,Authorization:`Bearer ${s.access_token}`};}
export async function getServerEntitlements():Promise<ServerEntitlement[]>{
  if(!backendConfigured||!getSession())return [];
  let h=await headers(); let r=await fetch(`${runtimeConfig.supabaseUrl}/rest/v1/entitlements?select=product_code,status,starts_at,ends_at,source&status=eq.active`,{headers:h!});
  if(r.status===401){await refreshSession();h=await headers();r=await fetch(`${runtimeConfig.supabaseUrl}/rest/v1/entitlements?select=product_code,status,starts_at,ends_at,source&status=eq.active`,{headers:h!});}
  if(!r.ok)throw new Error('Unable to restore purchases.');
  const rows=await r.json() as ServerEntitlement[]; const now=Date.now(); return rows.filter(x=>!x.ends_at||Date.parse(x.ends_at)>now);
}
