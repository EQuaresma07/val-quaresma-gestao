import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const sizes = await prisma.size.findMany({
    where: { deletedAt: null },
    orderBy: { displayOrder: 'asc' },
  });

  return NextResponse.json({ sizes });
}
