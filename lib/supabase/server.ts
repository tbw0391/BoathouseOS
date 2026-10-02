import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';

async function newClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // called from a Server Component; middleware refreshes the session instead
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // called from a Server Component; middleware refreshes the session instead
          }
        },
      },
    }
  );
}

// The layout, the theme, the header and the page all ask who's signed in, and
// each ask is a trip to the auth server. Within one page render they share a
// single answer. (React's cache only applies while rendering, so server
// actions that sign in or out still get a fresh answer.)
const requestUser = cache(async () => (await newClient()).auth.getUser());

export async function createClient() {
  const client = await newClient();
  const getUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = (jwt?: string) => (jwt ? getUser(jwt) : requestUser());
  return client;
}
