/**
 * PATCH  /api/products/[id]/variants/[variantId]  → atualizar variante
 * DELETE /api/products/[id]/variants/[variantId]  → soft delete
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// PATCH usa schema parcial (só atualiza o que vier)
const variantPatchSchema = z.object({
  sizeId: z.string().uuid().optional(),
  colorId: z.string().uuid().optional(),
  sku: z.string().min(1).max(60).optional(),
  barcode: z.string().max(60).optional().or(z.literal('')),
  costPrice: z.number().nonnegative().optional(),
  sellingPrice: z.number().positive().optional(),
  minStockAlert: z.number().int().nonnegative().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id: productId, variantId } = await params;
    const body = await request.json();
    const parsed = variantPatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
        { status: 400 },
      );
    }

    const existing = await prisma.productVariant.findFirst({
      where: { id: variantId, productId, deletedAt: null },
      select: {
        id: true,
        sku: true,
        costPrice: true,
        sellingPrice: true,
        sizeId: true,
        colorId: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Variante não encontrada' }, { status: 404 });
    }

    const data = parsed.data;

    // Validar SKU duplicado (em outra variante)
    if (data.sku && data.sku !== existing.sku) {
      const skuExists = await prisma.productVariant.findUnique({
        where: { sku: data.sku },
      });
      if (skuExists && skuExists.id !== variantId) {
        return NextResponse.json({ error: 'SKU já existe' }, { status: 400 });
      }
    }

    // Validar combinação tamanho+cor (em outra variante do mesmo produto)
    const newSizeId = data.sizeId ?? existing.sizeId;
    const newColorId = data.colorId ?? existing.colorId;
    if (newSizeId !== existing.sizeId || newColorId !== existing.colorId) {
      const comboExists = await prisma.productVariant.findFirst({
        where: {
          productId,
          sizeId: newSizeId,
          colorId: newColorId,
          deletedAt: null,
          NOT: { id: variantId },
        },
      });
      if (comboExists) {
        return NextResponse.json(
          { error: 'Já existe variante com esse tamanho e cor' },
          { status: 400 },
        );
      }
    }

    // Detectar mudança de preço pra registrar histórico
    const priceChanged =
      (data.costPrice !== undefined && Number(existing.costPrice) !== data.costPrice) ||
      (data.sellingPrice !== undefined && Number(existing.sellingPrice) !== data.sellingPrice);

    const updated = await prisma.$transaction(async (tx) => {
      const v = await tx.productVariant.update({
        where: { id: variantId },
        data: {
          ...(data.sizeId && { sizeId: data.sizeId }),
          ...(data.colorId && { colorId: data.colorId }),
          ...(data.sku && { sku: data.sku }),
          ...(data.barcode !== undefined && { barcode: data.barcode || null }),
          ...(data.costPrice !== undefined && { costPrice: data.costPrice }),
          ...(data.sellingPrice !== undefined && { sellingPrice: data.sellingPrice }),
          ...(data.minStockAlert !== undefined && { minStockAlert: data.minStockAlert }),
        },
      });

      if (priceChanged) {
        await tx.priceHistory.create({
          data: {
            variantId,
            oldCostPrice: existing.costPrice,
            newCostPrice: data.costPrice ?? existing.costPrice,
            oldSellingPrice: existing.sellingPrice,
            newSellingPrice: data.sellingPrice ?? existing.sellingPrice,
            reason: 'Edição manual',
          },
        });
      }

      return v;
    });

    return NextResponse.json({ variant: updated });
  } catch (error) {
    console.error('Erro ao atualizar variante:', error);
    return NextResponse.json({ error: 'Erro ao atualizar variante' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id: productId, variantId } = await params;

    const existing = await prisma.productVariant.findFirst({
      where: { id: variantId, productId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Variante não encontrada' }, { status: 404 });
    }

    // Verificar se é a última variante (não permitir deletar todas)
    const count = await prisma.productVariant.count({
      where: { productId, deletedAt: null },
    });
    if (count <= 1) {
      return NextResponse.json(
        { error: 'O produto precisa ter ao menos uma variante. Delete o produto inteiro se quiser remover.' },
        { status: 400 },
      );
    }

    await prisma.productVariant.update({
      where: { id: variantId },
      data: { deletedAt: new Date(), isActive: false },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro ao deletar variante:', error);
    return NextResponse.json({ error: 'Erro ao deletar variante' }, { status: 500 });
  }
}
