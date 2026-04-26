/**
 * GET  /api/products       → lista produtos
 * POST /api/products       → cria produto + variantes (transação)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { productSchema } from '@/lib/validations';

// ============================================================
// LISTAR
// ============================================================
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? '';
  const categoryId = searchParams.get('categoryId');

  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { brand: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  const products = await prisma.product.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      category: { select: { id: true, name: true } },
      variants: {
        where: { deletedAt: null },
        select: {
          id: true,
          stockQuantity: true,
          sellingPrice: true,
          sku: true,
        },
      },
    },
  });

  // Calcula estoque total e faixa de preço por produto
  const enriched = products.map((p) => {
    const totalStock = p.variants.reduce((s, v) => s + v.stockQuantity, 0);
    const prices = p.variants.map((v) => Number(v.sellingPrice));
    return {
      ...p,
      suggestedPrice: Number(p.suggestedPrice),
      totalStock,
      variantCount: p.variants.length,
      minPrice: prices.length ? Math.min(...prices) : Number(p.suggestedPrice),
      maxPrice: prices.length ? Math.max(...prices) : Number(p.suggestedPrice),
    };
  });

  return NextResponse.json({ products: enriched });
}

// ============================================================
// CRIAR
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await request.json();
    const parsed = productSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Verificar duplicidade de SKU/barcode
    const skus = data.variants.map((v) => v.sku).filter(Boolean);
    const barcodes = data.variants.map((v) => v.barcode).filter(Boolean) as string[];

    if (new Set(skus).size !== skus.length) {
      return NextResponse.json(
        { error: 'SKUs duplicados entre as variantes' },
        { status: 400 },
      );
    }

    const existingSkus = await prisma.productVariant.findMany({
      where: { sku: { in: skus } },
      select: { sku: true },
    });
    if (existingSkus.length > 0) {
      return NextResponse.json(
        { error: `SKU já existe: ${existingSkus.map((s) => s.sku).join(', ')}` },
        { status: 400 },
      );
    }

    if (barcodes.length > 0) {
      const existingBarcodes = await prisma.productVariant.findMany({
        where: { barcode: { in: barcodes } },
        select: { barcode: true },
      });
      if (existingBarcodes.length > 0) {
        return NextResponse.json(
          { error: `Código de barras já existe: ${existingBarcodes.map((b) => b.barcode).join(', ')}` },
          { status: 400 },
        );
      }
    }

    // Verificar variantes duplicadas (mesmo size + color)
    const combos = data.variants.map((v) => `${v.sizeId}-${v.colorId}`);
    if (new Set(combos).size !== combos.length) {
      return NextResponse.json(
        { error: 'Existem variantes duplicadas (mesmo tamanho + cor)' },
        { status: 400 },
      );
    }

    // Transação: cria produto + variantes + movimentações iniciais de estoque
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: data.name,
          description: data.description || null,
          brand: data.brand || null,
          gender: data.gender,
          categoryId: data.categoryId,
          suggestedPrice: data.suggestedPrice,
          imageUrl: data.imageUrl || null,
          sku: data.sku || null,
          barcode: data.barcode || null,
          variants: {
            create: data.variants.map((v) => ({
              sizeId: v.sizeId,
              colorId: v.colorId,
              sku: v.sku,
              barcode: v.barcode || null,
              costPrice: v.costPrice,
              sellingPrice: v.sellingPrice,
              stockQuantity: v.stockQuantity,
              minStockAlert: v.minStockAlert,
            })),
          },
        },
        include: { variants: true },
      });

      // Registrar movimentações iniciais de estoque
      for (const variant of created.variants) {
        if (variant.stockQuantity > 0) {
          await tx.stockMovement.create({
            data: {
              variantId: variant.id,
              type: 'INITIAL',
              quantity: variant.stockQuantity,
              balanceAfter: variant.stockQuantity,
              reason: 'Estoque inicial ao criar produto',
              userId: user.userId,
            },
          });
        }
      }

      return created;
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    return NextResponse.json(
      { error: 'Erro ao criar produto' },
      { status: 500 },
    );
  }
}
