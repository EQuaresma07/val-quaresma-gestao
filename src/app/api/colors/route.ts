import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const colors = await prisma.color.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ colors });
}
