// Route guard (Next.js 16 renamed the `middleware` file convention to `proxy`).
// Signed-out visitors go to /login; each area only opens for its role.
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
  if (pathname.startsWith("/admin") && role !== "BOARD_MEMBER") {
    return Response.redirect(new URL("/login?error=AccessDenied", req.nextUrl));
  }
});

export const config = { matcher: ["/admin/:path*", "/super_admin/:path*"] };
