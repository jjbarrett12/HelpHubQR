import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_TIMEOUT_MS = 5000;

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Don't hang forever if Supabase is slow/unreachable
  const userPromise = supabase.auth.getUser().then(({ data: { user } }) => user);
  const timeoutPromise = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), AUTH_TIMEOUT_MS)
  );
  const user = await Promise.race([userPromise, timeoutPromise]);

  if (request.nextUrl.pathname.startsWith("/app") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (request.nextUrl.pathname.startsWith("/platform-admin") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (request.nextUrl.pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return response;
}

// Only run for app and platform-admin. Public routes (/t/, /q/, /guest/, /login, /, /ping) are NOT matched – no auth required.
export const config = {
  matcher: ["/app/:path*", "/platform-admin/:path*"],
};
