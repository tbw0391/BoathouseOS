import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  CLUB_HOST_SUFFIX,
  CONSOLE_HOST,
  IS_DEMO_SITE,
  RECRUIT_HOST,
  clubSlugFromHost,
  isConsoleHost,
  isRecruitHost,
} from '@/lib/site';

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
    `img-src 'self' data: blob: ${supabaseUrl} https://*.tile.openstreetmap.org`,
    `font-src 'self' data:`,
    `connect-src 'self' ${supabaseUrl} ${supabaseWs}`,
  ].join('; ');
}

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const path = request.nextUrl.pathname;
  const onConsoleHost = isConsoleHost(host);
  const onRecruitHost = isRecruitHost(host);
  const onRecruit = path === '/recruit' || path.startsWith('/recruit/');

  // The old Global Admin pages moved into the console.
  if (path === '/global-admin' || path.startsWith('/global-admin/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/console' + path.slice('/global-admin'.length);
    return NextResponse.redirect(url);
  }

  // On production the console only lives at admin.boathouseos.app.
  if (!IS_DEMO_SITE && !onConsoleHost && (path === '/console' || path.startsWith('/console/'))) {
    return NextResponse.redirect(new URL(path + request.nextUrl.search, `https://${CONSOLE_HOST}`));
  }

  // On production the recruit pages only live at recruit.boathouseos.app.
  if (!IS_DEMO_SITE && !onRecruitHost && onRecruit) {
    return NextResponse.redirect(new URL(path + request.nextUrl.search, `https://${RECRUIT_HOST}`));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  // Tells the layout to show the console's own header instead of a club's.
  if (onConsoleHost || path === '/console' || path.startsWith('/console/')) {
    requestHeaders.set('x-console', '1');
  }
  // The club's public website (0112) has its own header and no app chrome.
  const onSite = path === '/site' || path.startsWith('/site/');
  if (onSite) requestHeaders.set('x-site', '1');
  // College coaches' recruit pages (0121): their own plain header.
  if (onRecruitHost || onRecruit) requestHeaders.set('x-recruit', '1');
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

  // getClaims refreshes the session like getUser did, but checks the token's
  // signature here instead of asking the auth server: one less round trip on
  // every page load. The database still checks the token on every query.
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims ?? null;

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup') ||
    request.nextUrl.pathname.startsWith('/auth') ||
    request.nextUrl.pathname.startsWith('/forgot-password') ||
    // Public so people who scan the "interested" QR code can leave their
    // details without signing in.
    request.nextUrl.pathname.startsWith('/interest') ||
    // The public landing page for visiting clubs.
    request.nextUrl.pathname === '/welcome' ||
    request.nextUrl.pathname === '/privacy' ||
    request.nextUrl.pathname === '/terms' ||
    // The club's public website: the page itself sends visitors to sign in
    // if the club hasn't turned it on.
    onSite ||
    // College coaches: the page explains, and checks who's signed in.
    onRecruit;

  // The console's address has only the console and signing in: no club
  // pages, no approval gate (the global admin belongs to no club).
  if (onConsoleHost) {
    const consoleSignIn = ['/login', '/forgot-password', '/reset-password', '/auth'].some(
      (p) => path === p || path.startsWith(p + '/')
    );
    const onConsole = path === '/console' || path.startsWith('/console/');
    if (!user && !consoleSignIn) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      return NextResponse.redirect(url);
    }
    if (user && !onConsole && path !== '/reset-password' && !path.startsWith('/auth')) {
      const url = request.nextUrl.clone();
      url.pathname = '/console';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return response;
  }

  // The recruit address has only the recruit pages and signing in.
  if (onRecruitHost) {
    const recruitSignIn = ['/login', '/forgot-password', '/reset-password', '/auth', '/terms', '/privacy'].some(
      (p) => path === p || path.startsWith(p + '/')
    );
    if (!onRecruit && !recruitSignIn) {
      return NextResponse.redirect(new URL('/recruit', request.url));
    }
    if (user && (path === '/login' || path === '/forgot-password')) {
      return NextResponse.redirect(new URL('/recruit', request.url));
    }
    return response;
  }

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    // The bare domain gets the landing page; deep links go straight to login.
    // (Production has no landing page.)
    // Production clubs' addresses open on their public website (which sends
    // visitors on to sign in if the club hasn't turned it on).
    url.pathname = request.nextUrl.pathname === '/' ? (IS_DEMO_SITE ? '/welcome' : '/site') : '/login';
    return NextResponse.redirect(url);
  }

  if (user && ['/login', '/signup', '/welcome'].includes(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Production: each club has its own address (<slug>.boathouseos.app). A
  // member who lands on another club's address goes to their own.
  if (user && !IS_DEMO_SITE) {
    const hostSlug = clubSlugFromHost(request.headers.get('x-forwarded-host') ?? request.headers.get('host'));
    if (hostSlug) {
      const { data: myClub } = await supabase.from('clubs').select('slug').maybeSingle();
      const mySlug = (myClub as { slug: string } | null)?.slug;
      // The global admin's account belongs to no club: off to the console.
      if (!mySlug) {
        const { data: isGlobalAdmin } = await supabase.rpc('is_global_admin');
        if (isGlobalAdmin) return NextResponse.redirect(new URL('/console', `https://${CONSOLE_HOST}`));
      }
      if (mySlug && mySlug !== hostSlug) {
        const url = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${mySlug}${CLUB_HOST_SUFFIX}`);
        return NextResponse.redirect(url);
      }
    }
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
      // A college coach's account belongs to no club: off to the recruit pages.
      const { data: isRecruiter } = await supabase.rpc('is_recruiter');
      if (isRecruiter) {
        return NextResponse.redirect(
          IS_DEMO_SITE ? new URL('/recruit', request.url) : new URL('/recruit', `https://${RECRUIT_HOST}`)
        );
      }
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
  // api/stripe/webhook, api/cron, api/calendar and api/twilio are skipped: they're called signed out
  // and check their own signature/secret. worker-*.js is the push handler the service
  // worker imports, which has to load for signed-out visitors too.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|club-icon|icons|branding|sw.js|workbox-.*|worker-.*|api/stripe/webhook|api/cron|api/calendar|api/twilio).*)'],
};
