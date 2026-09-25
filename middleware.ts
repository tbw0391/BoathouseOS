import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : '';
const supabaseWs = supabaseHost ? `wss://${supabaseHost}` : '';

// CSP is only enforced in production so the dev server's HMR (which relies
// on eval) isn't affected — mirrors the dev/prod split next-pwa already uses
// in next.config.ts. The nonce lets Next's own inline hydration scripts run
// while still blocking any other injected inline script.
function buildCsp(nonce: string) {
  return [
    `default-src 'self'`,
    `base-uri 'self'`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    // https: (not just specific hosts) because "Add regatta from a link"
    // (lib/urlMeta.ts / lib/crewtimer.ts) fetches a regatta's icon from
    // whatever domain the coach happened to paste — the set of hosts isn't
    // known ahead of time the way it is for e.g. Supabase or OSM tiles.
    `img-src 'self' data: blob: https: ${supabaseUrl}`,
    `font-src 'self' data:`,
    `connect-src 'self' ${supabaseUrl} ${supabaseWs}`,
  ].join('; ');
}

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  if (process.env.NODE_ENV === 'production') {
    requestHeaders.set('Content-Security-Policy', csp);
  }

  function freshResponse() {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    if (process.env.NODE_ENV === 'production') {
      res.headers.set('Content-Security-Policy', csp);
    }
    return res;
  }

  let response = freshResponse();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response = freshResponse();
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response = freshResponse();
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup') ||
    request.nextUrl.pathname.startsWith('/auth') ||
    request.nextUrl.pathname.startsWith('/forgot-password') ||
    // Public so people who scan the "interested" QR code can leave their
    // details without signing in.
    request.nextUrl.pathname.startsWith('/interest');

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // New self-signups wait on an admin, and removed members are locked out.
  // The database enforces this too (see 0060_member_approval.sql); this just
  // sends them somewhere that explains why everything is empty.
  if (user && !isAuthRoute) {
    const onPending = request.nextUrl.pathname.startsWith('/pending');
    const { data: approved, error: approvalError } = await supabase.rpc('is_approved');
    // If the check itself fails (e.g. the migration isn't applied yet), don't
    // lock everyone out; RLS still guards the data.
    if (!approvalError && !approved && !onPending) {
      const url = request.nextUrl.clone();
      url.pathname = '/pending';
      return NextResponse.redirect(url);
    }
    if (approved && onPending) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|branding|regatta-icons|sw.js|workbox-.*).*)'],
};
