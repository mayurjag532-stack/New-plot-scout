export const runtimeConfig = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, ""),
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  posthogKey: import.meta.env.VITE_POSTHOG_KEY || "",
  posthogHost: (import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, ""),
  appEnv: import.meta.env.VITE_APP_ENV || "development",
  ownerEmails: (import.meta.env.VITE_OWNER_EMAILS || "").split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean)
};
export const backendConfigured = Boolean(runtimeConfig.supabaseUrl && runtimeConfig.supabaseAnonKey);
