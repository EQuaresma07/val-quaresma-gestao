/**
 * GET    /api/products/[id]   → detalhes do produto
 * PATCH  /api/products/[id]   → atualiza dados do produto (sem variantes)
 * DELETE /api/products/[id]   → soft delete
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { productUpdateSchema } from '@/lib/validations';

// ============================================================
// GET — detalhes
// ============================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await params;

  const product = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    include: {
      category: true,
      variants: {
        where: { deletedAt: null },
        include: { size: true, color: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
  }

  return NextResponse.json({
    product: {
      ...product,
      suggestedPrice: Number(product.suggestedPrice),
      variants: product.variants.map((v) => ({
        ...v,
        costPrice: Number(v.costPrice),
        sellingPrice: Number(v.sellingPrice),
      })),
    },
  });
}

// ============================================================
// PATCH — atualizar produto
// ============================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const parsed = productUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
        { status: 400 },
      );
    }

    const existing = await prisma.product.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description || null }),
        ...(parsed.data.brand !== undefined && { brand: parsed.data.brand || null }),
        ...(parsed.data.gender !== undefined && { gender: parsed.data.gender }),
        ...(parsed.data.categoryId !== undefined && { categoryId: parsed.data.categoryId }),
        ...(parsed.data.suggestedPrice !== undefined && { suggestedPrice: parsed.data.suggestedPrice }),
        ...(parsed.data.imageUrl !== undefined && { imageUrl: parsed.data.imageUrl || null }),
        ...(parsed.data.sku !== undefined && { sku: parsed.data.sku || null }),
        ...(parsed.data.barcode !== undefined && { barcode: parsed.data.barcode || null }),
      },
    });

    return NextResponse.json({ product: updated });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    return NextResponse.json({ error: 'Erro ao atualizar produto' }, { status: 500 });
  }
}

// ============================================================
// DELETE — soft delete
// ============================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await params;

    const existing = await prisma.product.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    // Soft delete: produto e suas variantes
    await prisma.$transaction([
      prisma.productVariant.updateMany({
        where: { productId: id, deletedAt: null },
        data: { deletedAt: new Date(), isActive: false },
      }),
      prisma.product.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro ao deletar produto:', error);
    return NextResponse.json({ error: 'Erro ao deletar produto' }, { status: 500 });
  }
}
