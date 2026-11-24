import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const allowedRoutes = [
  /^api\/me\/?$/,
  /^api\/me\/avatar\/?$/,
  /^api\/board\/(club|stats|members)\/?$/,
  /^api\/board\/registrations\/weekly\/?$/,
  /^api\/board\/requests\/?$/,
  /^api\/board\/requests\/\d+\/(approve|reject)\/?$/,
  /^api\/board\/announcements\/?$/,
  /^api\/board\/announcements\/\d+\/?$/,
  /^api\/club-events\/?$/,
  /^api\/club-events\/\d+\/?$/,
  /^api\/superadmin\/organizations\/?$/,
  /^api\/superadmin\/organizations\/\d+\/?$/,
  /^api\/superadmin\/users\/?$/,
  /^api\/superadmin\/users\/\d+\/?$/,
  /^api\/superadmin\/events\/?$/,
  /^api\/superadmin\/events\/weekly\/?$/,
  /^api\/superadmin\/events\/\d+\/(approve|reject)\/?$/,
  /^api\/superadmin\/stats\/?$/,
  /^api\/superadmin\/roles\/distribution\/?$/,
  /^api\/superadmin\/audit-log\/?$/,
  /^api\/superadmin\/settings\/?$/,
  /^api\/superadmin\/settings\/\d+\/?$/,
];

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  if (!session?.backendToken) {
    return NextResponse.json({ detail: "Authentication required." }, { status: 401 });
  }

  const { path } = await context.params;
  const pathName = path.join("/");
  if (!allowedRoutes.some((route) => route.test(pathName))) {
    return NextResponse.json({ detail: "Endpoint is not available." }, { status: 404 });
  }

  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    return NextResponse.json({ detail: "BACKEND_URL is not configured." }, { status: 500 });
  }

  const query = request.nextUrl.search;
  const target = `${backendUrl.replace(/\/$/, "")}/${pathName}/${query}`;
  const headers = new Headers({
    Authorization: `Token ${session.backendToken}`,
  });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method)
        ? undefined
        : await request.arrayBuffer(),
      cache: "no-store",
    });
    const responseHeaders = new Headers();
    const responseType = response.headers.get("content-type");
    if (responseType) responseHeaders.set("Content-Type", responseType);
    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Dashboard backend proxy failed:", error);
    return NextResponse.json(
      { detail: "The backend service could not be reached." },
      { status: 502 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
