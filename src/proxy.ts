import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const protectedPaths = [
    "/dashboard",
    "/employees",
    "/upload",
    "/claims",
    "/services",
    "/settings",
    "/inventory",
    "/users",
    "/api/services",
    "/api/inventory",
    "/api/admin/users",
    "/api/upload",
    "/api/claims",
    "/api/employees",
    "/api/trips",
    "/api/envgate"
  ];
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));
  const isRoot = pathname === "/";
  const isLoginPage = pathname === "/login";

  // Cek murah dulu: tanpa cookie auth sama sekali tidak perlu menanya ke
  // server auth. getUser() = roundtrip ke container auth untuk SETIAP
  // request — pengunjung anonim pun tadinya ikut membayarnya, jadi kalau
  // auth sebentar lambat/mati semua halaman ikut terasa "tidak konek".
  const hasAuthCookies = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));

  if (!hasAuthCookies) {
    // Root & halaman proteksi → langsung arahkan ke login (tanpa roundtrip)
    if (isRoot || isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    // Halaman publik (login/docs/approve/…) untuk anonim → selesai
    return supabaseResponse;
  }

  // Ada cookie → validasi sesi ke server auth (jalan aman untuk route
  // proteksi maupun redirect login→dashboard).
  let user = null;
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );
    const res = await supabase.auth.getUser();
    user = res.data?.user || null;
  } catch (e) {
    // Server auth tidak terjangkau sekejap — jangan 500/error page
    // (dulu terasa seperti "situs tidak konek"). Anonim untuk route
    // publik; route proteksi diarahkan login seperti biasa.
    console.error("proxy: getUser gagal:", e);
    user = null;
  }

  if (isProtected && !user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Redirect pengguna yang sudah login dari halaman login
  if (isLoginPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Redirect root ke dashboard/login
  if (isRoot) {
    const url = request.nextUrl.clone();
    url.pathname = user ? "/dashboard" : "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
