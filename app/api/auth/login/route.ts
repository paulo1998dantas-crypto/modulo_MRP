import { NextResponse } from "next/server";
import { authenticateMrpUser, cookieOptions, createMrpSession, MRP_SESSION_COOKIE } from "../../../lib/shared-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: unknown; password?: unknown };
    const principal = await authenticateMrpUser(String(body.username ?? ""), String(body.password ?? ""));
    if (!principal) {
      return NextResponse.json(
        { error: "Usuário, senha ou perfil sem permissão para o MRP." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    const session = createMrpSession(principal);
    const response = NextResponse.json(
      { user: { username: principal.username, roles: principal.roles } },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(MRP_SESSION_COOKIE, session.token, cookieOptions(session.expiresAt));
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível validar o acesso." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
