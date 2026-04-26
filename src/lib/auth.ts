/**
 * SISTEMA DE AUTENTICAÇÃO
 *
 * - Hash de senha com bcrypt (10 rounds)
 * - JWT assinado com chave secreta (jose - edge-compatible)
 * - Token armazenado em cookie HttpOnly + Secure + SameSite=Strict
 *
 * Segurança:
 * ✓ HttpOnly: JavaScript do navegador não acessa o token (anti-XSS)
 * ✓ Secure: cookie só viaja por HTTPS em produção
 * ✓ SameSite=Strict: bloqueia CSRF
 * ✓ Senha nunca trafega em logs nem retorna em respostas
 */

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { UserRole } from '@prisma/client';

const COOKIE_NAME = 'atelier_session';
const ALGORITHM = 'HS256';

// ============================================
// VALIDAÇÃO DE ENV
// ============================================

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET ausente ou muito curto. Defina uma chave de pelo menos 32 caracteres.',
    );
  }
  return new TextEncoder().encode(secret);
}

function getExpirationHours(): number {
  const hours = Number(process.env.JWT_EXPIRES_IN_HOURS ?? 12);
  return Number.isFinite(hours) && hours > 0 ? hours : 12;
}

// ============================================
// HASH DE SENHA
// ============================================

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 6) {
    throw new Error('A senha deve ter no mínimo 6 caracteres.');
  }
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================
// PAYLOAD DO JWT
// ============================================

export interface SessionPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
}

// ============================================
// TOKEN: criar e verificar
// ============================================

export async function createToken(payload: SessionPayload): Promise<string> {
  const expiresIn = getExpirationHours() * 60 * 60; // segundos
  const exp = Math.floor(Date.now() / 1000) + expiresIn;

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(getJwtSecret());
}

export async function verifyToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: [ALGORITHM],
    });

    if (
      typeof payload.userId !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.name !== 'string'
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role as UserRole,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

// ============================================
// COOKIES: ler, gravar, apagar
// ============================================

export async function setSessionCookie(token: string): Promise<void> {
  const expiresIn = getExpirationHours() * 60 * 60;
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: expiresIn,
  });
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// ============================================
// HELPER: pegar usuário da sessão atual
// ============================================

export async function getCurrentUser(): Promise<SessionPayload | null> {
  const token = await getSessionToken();
  if (!token) return null;
  return verifyToken(token);
}
