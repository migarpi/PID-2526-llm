import { NextRequest, NextResponse } from "next/server";

const BASIC_USER = process.env.ADMIN_USER;
const BASIC_PASS = process.env.ADMIN_PASS;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protegemos /admin y /api/admin/*
  const protectedPaths = ["/admin", "/api/admin"];
  const isProtected = protectedPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isProtected) return NextResponse.next();

  // Header Authorization: "Basic base64(user:pass)"
  const auth = req.headers.get("authorization") || "";
  const [scheme, encoded] = auth.split(" ");

  if (scheme === "Basic" && encoded) {
    try {
      // atob está disponible en el runtime del middleware (edge)
      const decoded = atob(encoded);
      const [user, pass] = decoded.split(":");

      if (user === BASIC_USER && pass === BASIC_PASS) {
        return NextResponse.next();
      }
    } catch (e) {
      // si falla el decode, cae a pedir credenciales
    }
  }

  // Pedimos credenciales al navegador
  const res = new NextResponse("Authentication required", { status: 401 });
  res.headers.set("WWW-Authenticate", 'Basic realm="Secure Area"');
  return res;
}

// Aplica a /admin y /api/admin
export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};