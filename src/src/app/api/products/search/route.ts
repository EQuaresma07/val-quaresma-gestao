/**
 * GET /api/products/search?q=TERMO&barcode=1
 *
 * Busca produtos/variantes para o PDV.
 *
 * - Se barcode=1, busca exata por código de barras (variant.barcode)
 *   Retorna 0 ou 1 variante.
 *
 * - Caso contrário, busca por nome do produto OU SKU da variante.
 *   Retorna lista de variantes com produto/tamanho/cor incluídos.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const isBarcode = searchParams.get('barcode') === '1';

  if (!q) {
    return NextResponse.json({ variants: [] });
  }

  if (isBarcode) {
    const variant = await prisma.productVariant.findFirst({
      where: {
        OR: [{ barcode: q }, { sku: q }],
        deletedAt: null,
        isActive: true,
      },
      include: {
        product: { select: { id: true, name: true, brand: true, imageUrl: true } },
        size: { select: { id: true, name: true } },
        color: { select: { id: true, name: true, hexCode: true } },
      },
    });

    return NextResponse.json({
      variants: variant
        ? [{
            ...variant,
            costPrice: Number(variant.costPrice),
            sellingPrice: Number(variant.sellingPrice),
          }]
        : [],
    });
  }

  // Busca textual
  const where: Prisma.ProductVariantWhereInput = {
    deletedAt: null,
    isActive: true,
    OR: [
      { sku: { contains: q, mode: 'insensitive' } },
      { product: { name: { contains: q, mode: 'insensitive' }, deletedAt: null } },
      { product: { brand: { contains: q, mode: 'insensitive' }, deletedAt: null } },
    ],
  };

  const variants = await prisma.productVariant.findMany({
    where,
    take: 30,
    include: {
      product: { select: { id: true, name: true, brand: true, imageUrl: true } },
      size: { select: { id: true, name: true } },
      color: { select: { id: true, name: true, hexCode: true } },
    },
    orderBy: { product: { name: 'asc' } },
  });

  return NextResponse.json({
    variants: variants.map((v) => ({
      ...v,
      costPrice: Number(v.costPrice),
      sellingPrice: Number(v.sellingPrice),
    })),
  });
}
