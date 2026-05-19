import type { NextConfig } from "next";

// Derive a client-safe boolean flag from server-side Supabase credential
// presence. This is the ONLY place the credential check is mapped into
// the client bundle. Feature code reads `isRemotePrimaryClient()` from
// `lib/remote-mode.ts`, which checks `NEXT_PUBLIC_REMOTE_PRIMARY === '1'`.
// The service-role key itself is never inlined into the client.
const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REMOTE_PRIMARY_FLAG = supabaseUrl && supabaseKey ? '1' : '0';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_REMOTE_PRIMARY: REMOTE_PRIMARY_FLAG,
  },
};

export default nextConfig;
