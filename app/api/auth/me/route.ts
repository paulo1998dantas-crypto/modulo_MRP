import { NextResponse } from "next/server";
import { getMrpPrincipal } from "../../../lib/shared-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const principal = await getMrpPrincipal();
    if (!principal) return NextResponse.json({ error: "Sessão ausente, expirada ou sem permissão." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ user: { username: principal.username, roles: principal.roles } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível validar a sessão." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
