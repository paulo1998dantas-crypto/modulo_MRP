import { NextResponse } from "next/server";
import { getMrpPrincipal } from "../../../lib/shared-auth";

export const dynamic = "force-dynamic";

type ScenarioRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  vehicles: unknown[];
  materials: unknown[];
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function getConfig() {
  const url = text(process.env.SUPABASE_URL).replace(/\/$/, "");
  const serviceKey = text(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
  if (!url || !serviceKey) throw new Error("MRP sem conexão com a base de cenários.");
  return { url, serviceKey };
}

function headers(serviceKey: string, extra: Record<string, string> = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function serialize(row: ScenarioRow) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    vehicles: Array.isArray(row.vehicles) ? row.vehicles : [],
    materials: Array.isArray(row.materials) ? row.materials : [],
  };
}

function validId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function validCollection(value: unknown) {
  return Array.isArray(value) && value.length <= 2000;
}

async function resolveId(context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return text(id);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const principal = await getMrpPrincipal();
    if (!principal) return NextResponse.json({ error: "Sessão ausente ou sem permissão." }, { status: 401 });
    const id = await resolveId(context);
    if (!validId(id)) return NextResponse.json({ error: "Identificador de cenário inválido." }, { status: 400 });

    const body = (await request.json()) as { name?: unknown; vehicles?: unknown; materials?: unknown };
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) {
      const name = text(body.name);
      if (!name || name.length > 200) return NextResponse.json({ error: "Nome de cenário inválido." }, { status: 400 });
      payload.name = name;
    }
    if (body.vehicles !== undefined) {
      if (!validCollection(body.vehicles)) return NextResponse.json({ error: "Lista de veículos inválida." }, { status: 400 });
      payload.vehicles = body.vehicles;
    }
    if (body.materials !== undefined) {
      if (!validCollection(body.materials)) return NextResponse.json({ error: "Lista de materiais inválida." }, { status: 400 });
      payload.materials = body.materials;
    }

    const { url, serviceKey } = getConfig();
    const endpoint = new URL(`${url}/rest/v1/mrp_scenarios`);
    endpoint.searchParams.set("id", `eq.${id}`);
    endpoint.searchParams.set("select", "id,name,created_at,updated_at,vehicles,materials");
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: headers(serviceKey, { Prefer: "return=representation" }),
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Não foi possível atualizar o cenário (${response.status}).`);
    const rows = (await response.json()) as ScenarioRow[];
    const row = rows[0];
    if (!row) return NextResponse.json({ error: "Cenário não encontrado." }, { status: 404 });
    return NextResponse.json({ scenario: serialize(row) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível atualizar o cenário." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const principal = await getMrpPrincipal();
    if (!principal) return NextResponse.json({ error: "Sessão ausente ou sem permissão." }, { status: 401 });
    const id = await resolveId(context);
    if (!validId(id)) return NextResponse.json({ error: "Identificador de cenário inválido." }, { status: 400 });

    const { url, serviceKey } = getConfig();
    const endpoint = new URL(`${url}/rest/v1/mrp_scenarios`);
    endpoint.searchParams.set("id", `eq.${id}`);
    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: headers(serviceKey, { Prefer: "return=representation" }),
    });
    if (!response.ok) throw new Error(`Não foi possível excluir o cenário (${response.status}).`);
    const rows = (await response.json()) as ScenarioRow[];
    if (!rows.length) return NextResponse.json({ error: "Cenário não encontrado." }, { status: 404 });
    return NextResponse.json({ deleted: id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível excluir o cenário." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
