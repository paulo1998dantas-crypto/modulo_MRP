import { NextResponse } from "next/server";
import { MRP_SESSION_COOKIE } from "../../../lib/shared-auth";

export async function POST() {
  const response = new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  response.cookies.set(MRP_SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
