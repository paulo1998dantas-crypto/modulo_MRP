import { createHmac, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";

const scrypt = promisify(nodeScrypt);

export const MRP_SESSION_COOKIE = "ji_mrp_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const ALLOWED_ROLES = new Set(["ADMIN", "PCP"]);

type Row = Record<string, unknown>;

export type MrpPrincipal = {
  id: number;
  username: string;
  roles: string[];
  authVersion: number;
};

type SessionPayload = {
  v: 1;
  userId: number;
  authVersion: number;
  exp: number;
  nonce: string;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function getConfig() {
  const url = text(process.env.SUPABASE_URL).replace(/\/$/, "");
  const serviceKey = text(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
  const sessionSecret = text(process.env.MRP_SESSION_SECRET);
  if (!url || !serviceKey) {
    throw new Error("MRP sem conexão com a base operacional. Configure SUPABASE_URL e a chave de serviço somente no ambiente do servidor.");
  }
  if (sessionSecret.length < 32) {
    throw new Error("MRP sem proteção de sessão. Configure MRP_SESSION_SECRET com pelo menos 32 caracteres somente no ambiente do servidor.");
  }
  return { url, serviceKey, sessionSecret };
}

async function readRows(table: string, params: Record<string, string>) {
  const { url, serviceKey } = getConfig();
  const endpoint = new URL(`${url}/rest/v1/${table}`);
  Object.entries(params).forEach(([key, value]) => endpoint.searchParams.set(key, value));
  const response = await fetch(endpoint, {
    cache: "no-store",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Não foi possível validar o acesso no cadastro compartilhado (${response.status}).`);
  }
  return (await response.json()) as Row[];
}

function isSafeUsername(username: string) {
  return /^[a-zA-Z0-9._-]{1,64}$/.test(username);
}

async function verifyWerkzeugScrypt(password: string, passwordHash: string) {
  const [method, salt, expectedHex] = passwordHash.split("$");
  const [algorithm, nRaw, rRaw, pRaw] = method.split(":");
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (
    algorithm !== "scrypt" ||
    !salt ||
    !/^[0-9a-f]+$/i.test(expectedHex || "") ||
    !Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p) ||
    n < 2 || (n & (n - 1)) !== 0 || r < 1 || p < 1
  ) {
    return false;
  }
  const expected = Buffer.from(expectedHex, "hex");
  const calculated = (await scrypt(password, salt, expected.length, {
    N: n,
    r,
    p,
    maxmem: Math.max(128 * n * r + 1024 * 1024, 128 * 1024 * 1024),
  })) as Buffer;
  return expected.length === calculated.length && timingSafeEqual(expected, calculated);
}

async function loadPrincipalById(userId: number): Promise<MrpPrincipal | null> {
  const users = await readRows("users", {
    select: "id,username,active,auth_version",
    id: `eq.${userId}`,
    limit: "1",
  });
  const user = users[0];
  if (!user || user.active !== true) return null;

  const roleRows = await readRows("erp_user_roles", {
    select: "role_code",
    user_id: `eq.${userId}`,
  });
  const roles = [...new Set(roleRows.map((row) => text(row.role_code).toUpperCase()).filter(Boolean))];
  if (!roles.some((role) => ALLOWED_ROLES.has(role))) return null;

  return {
    id: Number(user.id),
    username: text(user.username),
    roles,
    authVersion: Number(user.auth_version) || 1,
  };
}

function encodePayload(payload: SessionPayload, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function decodePayload(token: string, secret: string): SessionPayload | null {
  const [body, suppliedSignature] = token.split(".");
  if (!body || !suppliedSignature) return null;
  const expectedSignature = createHmac("sha256", secret).update(body).digest("base64url");
  const left = Buffer.from(suppliedSignature);
  const right = Buffer.from(expectedSignature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (
      payload.v !== 1 ||
      !Number.isInteger(payload.userId) ||
      !Number.isInteger(payload.authVersion) ||
      !Number.isFinite(payload.exp) ||
      payload.exp * 1000 <= Date.now()
    ) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function authenticateMrpUser(usernameInput: string, password: string) {
  const username = text(usernameInput);
  if (!isSafeUsername(username) || !password) return null;
  const users = await readRows("users", {
    select: "id,username,password_hash,active,auth_version",
    username: `ilike.${username}`,
    limit: "1",
  });
  const user = users[0];
  if (!user || user.active !== true) return null;
  if (!(await verifyWerkzeugScrypt(password, text(user.password_hash)))) return null;
  return loadPrincipalById(Number(user.id));
}

export function createMrpSession(principal: MrpPrincipal) {
  const { sessionSecret } = getConfig();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return {
    token: encodePayload({
      v: 1,
      userId: principal.id,
      authVersion: principal.authVersion,
      exp: expiresAt,
      nonce: randomBytes(16).toString("base64url"),
    }, sessionSecret),
    expiresAt,
  };
}

export async function getMrpPrincipal(): Promise<MrpPrincipal | null> {
  const { sessionSecret } = getConfig();
  const token = (await cookies()).get(MRP_SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = decodePayload(token, sessionSecret);
  if (!payload) return null;
  const principal = await loadPrincipalById(payload.userId);
  if (!principal || principal.authVersion !== payload.authVersion) return null;
  return principal;
}

export function cookieOptions(expiresAt: number) {
  const forceSecure = text(process.env.MRP_SESSION_COOKIE_SECURE);
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: forceSecure ? forceSecure === "1" : process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt * 1000),
  };
}
