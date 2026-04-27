/**
 * GET /api/customers/search?q=TERMO
 *
 * Busca clientes por nome, telefone ou CPF.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';

  if (!q) {
    return NextResponse.json({ customers: [] });
  }

  const customers = await prisma.customer.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { cpf: { contains: q } },
      ],
    },
    take: 20,
    select: {
      id: true,
      name: true,
      phone: true,
      cpf: true,
      creditLimit: true,
      currentDebt: true,
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({
    customers: customers.map((c) => ({
      ...c,
      creditLimit: Number(c.creditLimit),
      currentDebt: Number(c.currentDebt),
    })),
  });
}
