// On Next.js 16+ this file may need to be named proxy.ts, check the docs for your version.
import { auth } from "@/auth";

export default auth((req) => {
  if (!req.auth) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return Response.redirect(url);
  }
});

export const config = { matcher: ["/dashboard/:path*"] };