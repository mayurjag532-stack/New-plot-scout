import { backendConfigured, runtimeConfig } from "./config";
export type Session = { access_token:string; refresh_token:string; expires_in:number; user:{id:string;email?:string} };
const KEY="plot-scout:session:v1";
export function getSession():Session|null{try{return JSON.parse(localStorage.getItem(KEY)||"null")}catch{return null}}
function store(v:Session|null){if(v)localStorage.setItem(KEY,JSON.stringify(v));else localStorage.removeItem(KEY);window.dispatchEvent(new CustomEvent("plot-scout-auth-change"));}
async function authFetch(path:string,body:unknown){if(!backendConfigured)throw new Error("Production authentication is not configured.");const r=await fetch(`${runtimeConfig.supabaseUrl}/auth/v1/${path}`,{method:"POST",headers:{apikey:runtimeConfig.supabaseAnonKey,"Content-Type":"application/json"},body:JSON.stringify(body)});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.msg||data?.error_description||data?.message||"Authentication failed.");return data;}
export async function signUp(email:string,password:string){const d=await authFetch("signup",{email,password});if(d.access_token)store(d as Session);return d;}
export async function signIn(email:string,password:string){const d=await authFetch("token?grant_type=password",{email,password}) as Session;store(d);return d;}
export async function signOut(){const s=getSession();if(s&&backendConfigured)await fetch(`${runtimeConfig.supabaseUrl}/auth/v1/logout`,{method:"POST",headers:{apikey:runtimeConfig.supabaseAnonKey,Authorization:`Bearer ${s.access_token}`}}).catch(()=>{});store(null);}
export async function refreshSession(){const s=getSession();if(!s)return null;const d=await authFetch("token?grant_type=refresh_token",{refresh_token:s.refresh_token}) as Session;store(d);return d;}
