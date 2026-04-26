/**
 * POST /api/auth/logout
 *
 * Limpa o cookie de sessão. Idempotente.
 */

import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
