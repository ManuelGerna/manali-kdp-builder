import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const LOGIN_PATH = "/login";

type SupabaseCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

function redirectToLogin(request: NextRequest, reason?: string) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = LOGIN_PATH;

  if (request.nextUrl.pathname !== "/") {
    redirectUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
  }

  if (reason) {
    redirectUrl.searchParams.set(reason, "supabase");
  }

  return NextResponse.redirect(redirectUrl);
}

export async function updateSession(request: NextRequest) {
  const isLoginRoute = request.nextUrl.pathname === LOGIN_PATH;

  if (!hasSupabaseConfig()) {
    if (isLoginRoute) {
      return NextResponse.next();
    }

    return redirectToLogin(request, "setup");
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: SupabaseCookie[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isLoginRoute) {
    return redirectToLogin(request);
  }

  if (user && isLoginRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/libri";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
