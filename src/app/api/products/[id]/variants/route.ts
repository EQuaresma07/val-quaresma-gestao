/**
 * GET  /api/products/[id]/variants  → lista variantes
 * POST /api/products/[id]/variants  → cria nova variante
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { variantSchema } from '@/lib/validations';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await params;

  const variants = await prisma.productVariant.findMany({
    where: { productId: id, deletedAt: null },
    include: { size: true, color: true },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({
    variants: variants.map((v) => ({
      ...v,
      costPrice: Number(v.costPrice),
      sellingPrice: Number(v.sellingPrice),
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id: productId } = await params;
    const body = await request.json();
    const parsed = variantSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Validar que o produto existe
    const product = await prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
    });
    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    // Verificar SKU duplicado
    const existingSku = await prisma.productVariant.findUnique({
      where: { sku: data.sku },
    });
    if (existingSku) {
      return NextResponse.json({ error: 'SKU já existe' }, { status: 400 });
    }

    // Verificar combinação tamanho+cor já existe
    const existingCombo = await prisma.productVariant.findFirst({
      where: {
        productId,
        sizeId: data.sizeId,
        colorId: data.colorId,
        deletedAt: null,
      },
    });
    if (existingCombo) {
      return NextResponse.json(
        { error: 'Já existe variante com esse tamanho e cor' },
        { status: 400 },
      );
    }

    const variant = await prisma.$transaction(async (tx) => {
      const v = await tx.productVariant.create({
        data: {
          productId,
          sizeId: data.sizeId,
          colorId: data.colorId,
          sku: data.sku,
          barcode: data.barcode || null,
          costPrice: data.costPrice,
          sellingPrice: data.sellingPrice,
          stockQuantity: data.stockQuantity,
          minStockAlert: data.minStockAlert,
        },
      });

      if (data.stockQuantity > 0) {
        await tx.stockMovement.create({
          data: {
            variantId: v.id,
            type: 'INITIAL',
            quantity: data.stockQuantity,
            balanceAfter: data.stockQuantity,
            reason: 'Estoque inicial da nova variante',
            userId: user.userId,
          },
        });
      }

      return v;
    });

    return NextResponse.json({ variant }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar variante:', error);
    return NextResponse.json({ error: 'Erro ao criar variante' }, { status: 500 });
  }
}
