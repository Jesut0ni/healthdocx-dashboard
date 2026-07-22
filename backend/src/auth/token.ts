import { createHmac, timingSafeEqual } from "node:crypto";

export type AuthTokenPayload = {
  sub: string;
  email: string;
  name: string;
  access: string;
  exp: number;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET is required for authentication.");
  }

  return secret;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

export function createAuthToken(payload: Omit<AuthTokenPayload, "exp">) {
  const tokenPayload: AuthTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
  };
  const body = encodeBase64Url(JSON.stringify(tokenPayload));
  return `${body}.${sign(body)}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const [body, signature] = token.split(".");

  if (!body || !signature) {
    throw new Error("Invalid session token.");
  }

  const expectedSignature = sign(body);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new Error("Invalid session token.");
  }

  const payload = JSON.parse(decodeBase64Url(body)) as AuthTokenPayload;

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Session expired.");
  }

  return payload;
}
