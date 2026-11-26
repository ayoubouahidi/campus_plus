// On Next.js 16+ this file may need to be named proxy.ts, check the docs for your version.
import { auth } from "@/auth";

export default auth((req) => {
  const pathname = req.nextUrl.pathname;

  if (!req.auth) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return Response.redirect(url);
  }

  const role = req.auth.user?.role;
  if (pathname.startsWith("/super_admin") && role !== "SUPERADMIN") {
    return Response.redirect(new URL("/login?error=AccessDenied", req.nextUrl));
  }

  if (
    pathname.startsWith("/admin") &&
    role !== "BOARD_MEMBER" &&
    role !== "SUPERADMIN"
  ) {
    return Response.redirect(new URL("/login?error=AccessDenied", req.nextUrl));
  }
});

export const config = { matcher: ["/admin/:path*", "/super_admin/:path*"] };