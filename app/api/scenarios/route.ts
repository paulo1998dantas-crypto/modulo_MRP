import { NextResponse } from "next/server";
import { getMrpPrincipal } from "../../lib/shared-auth";

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

export async function GET() {
  try {
    const principal = await getMrpPrincipal();
    if (!principal) return NextResponse.json({ error: "Sessão ausente ou sem permissão." }, { status: 401 });

    const { url, serviceKey } = getConfig();
    const endpoint = new URL(`${url}/rest/v1/mrp_scenarios`);
    endpoint.searchParams.set("select", "id,name,created_at,updated_at,vehicles,materials");
    endpoint.searchParams.set("order", "created_at.desc");
    const response = await fetch(endpoint, { cache: "no-store", headers: headers(serviceKey) });
    if (!response.ok) throw new Error(`Não foi possível carregar os cenários (${response.status}).`);
    const rows = (await response.json()) as ScenarioRow[];
    return NextResponse.json({ scenarios: rows.map(serialize) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível carregar os cenários." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  try {
    const principal = await getMrpPrincipal();
    if (!principal) return NextResponse.json({ error: "Sessão ausente ou sem permissão." }, { status: 401 });

    const body = (await request.json()) as { name?: unknown };
    const name = text(body.name);
    if (!name || name.length > 200) return NextResponse.json({ error: "Informe um nome de cenário entre 1 e 200 caracteres." }, { status: 400 });

    const { url, serviceKey } = getConfig();
    const endpoint = new URL(`${url}/rest/v1/mrp_scenarios`);
    endpoint.searchParams.set("select", "id,name,created_at,updated_at,vehicles,materials");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: headers(serviceKey, { Prefer: "return=representation" }),
      body: JSON.stringify({ name, created_by: principal.id, vehicles: [], materials: [] }),
    });
    if (!response.ok) throw new Error(`Não foi possível salvar o cenário (${response.status}).`);
    const rows = (await response.json()) as ScenarioRow[];
    const row = rows[0];
    if (!row) throw new Error("O cenário não foi retornado pela base.");
    return NextResponse.json({ scenario: serialize(row) }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível criar o cenário." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
