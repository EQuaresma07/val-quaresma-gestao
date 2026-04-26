/**
 * GET /api/auth/me
 *
 * Retorna o usuário da sessão atual. Útil pro frontend confirmar
 * autenticação e recuperar dados básicos.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user });
}
