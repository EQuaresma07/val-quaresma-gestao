/**
 * GET  /api/sales        → lista vendas (com filtros)
 * POST /api/sales        → cria nova venda (transação completa)
 *
 * Ao criar uma venda:
 *   1. Valida estoque de cada item
 *   2. Cria sale + sale_items + sale_payments
 *   3. Desconta estoque das variantes
 *   4. Registra stock_movement de cada item
 *   5. Cria parcelas (se fiado parcelado)
 *   6. Atualiza dívida do cliente (se fiado)
 *   7. Registra cash_flow (entradas à vista)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma, PaymentMethod, SaleStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// ============================================================
// Schema de validação
// ============================================================
const saleItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  discount: z.number().nonnegative().default(0),
});

const salePaymentSchema = z.object({
  method: z.enum(['PIX', 'DEBIT', 'CREDIT', 'CASH', 'CREDIT_NOTE']),
  amount: z.number().positive(),
  installments: z.number().int().min(1).max(12).default(1),
});

const saleSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  items: z.array(saleItemSchema).min(1, 'Carrinho vazio'),
  payments: z.array(salePaymentSchema).min(1, 'Sem forma de pagamento'),
  discount: z.number().nonnegative().default(0),
  notes: z.string().max(500).optional(),
});

// ============================================================
// LISTAR VENDAS
// ============================================================
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const status = searchParams.get('status') ?? 'COMPLETED';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);

  const where: Prisma.SaleWhereInput = { deletedAt: null };

  if (status === 'TODAY') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    where.saleDate = { gte: today };
  } else if (startDate || endDate) {
    where.saleDate = {};
    if (startDate) where.saleDate.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.saleDate.lte = end;
    }
  }

  if (status && status !== 'ALL' && status !== 'TODAY') {
    where.status = status as SaleStatus;
  }

  const sales = await prisma.sale.findMany({
    where,
    take: limit,
    orderBy: { saleDate: 'desc' },
    include: {
      customer: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          subtotal: true,
          variant: {
            select: {
              id: true,
              sku: true,
              size: { select: { name: true } },
              color: { select: { name: true } },
              product: { select: { id: true, name: true, imageUrl: true } },
            },
          },
        },
      },
      payments: {
        select: {
          id: true,
          method: true,
          amount: true,
          installments: true,
        },
      },
      _count: { select: { items: true } },
    },
  });

  return NextResponse.json({
    sales: sales.map((s) => ({
      ...s,
      total: Number(s.total),
      subtotal: Number(s.subtotal),
      discountAmount: Number(s.discountAmount),
      amountPaid: Number(s.amountPaid),
      items: s.items.map((i) => ({
        ...i,
        unitPrice: Number(i.unitPrice),
        subtotal: Number(i.subtotal),
      })),
      payments: s.payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
    })),
  });
}

// ============================================================
// CRIAR VENDA
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await request.json();
    const parsed = saleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // ========== Calcular totais ==========
    const subtotal = data.items.reduce(
      (acc, item) => acc + item.unitPrice * item.quantity - item.discount,
      0,
    );
    const total = Math.max(0, subtotal - data.discount);
    const totalPayments = data.payments.reduce((acc, p) => acc + p.amount, 0);

    if (Math.abs(totalPayments - total) > 0.01) {
      return NextResponse.json(
        {
          error: `Soma dos pagamentos (R$ ${totalPayments.toFixed(2)}) não confere com total (R$ ${total.toFixed(2)})`,
        },
        { status: 400 },
      );
    }

    // ========== Validar fiado e cliente ==========
    const fiadoAmount = data.payments
      .filter((p) => p.method === 'CREDIT_NOTE')
      .reduce((acc, p) => acc + p.amount, 0);
    const hasFiado = fiadoAmount > 0;

    if (hasFiado && !data.customerId) {
      return NextResponse.json(
        { error: 'Venda fiada exige cliente identificado' },
        { status: 400 },
      );
    }

    if (data.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: data.customerId, deletedAt: null },
      });
      if (!customer) {
        return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
      }

      if (hasFiado) {
        const newDebt = Number(customer.currentDebt) + fiadoAmount;
        const limit = Number(customer.creditLimit);
        if (limit > 0 && newDebt > limit) {
          return NextResponse.json(
            {
              error: `Limite de crédito excedido. Limite: R$ ${limit.toFixed(2)}, dívida atual: R$ ${Number(customer.currentDebt).toFixed(2)}`,
            },
            { status: 400 },
          );
        }
      }
    }

    // ========== Validar estoque ==========
    const variantIds = data.items.map((i) => i.variantId);
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, deletedAt: null, isActive: true },
      include: {
        product: { select: { name: true } },
        size: { select: { name: true } },
        color: { select: { name: true } },
      },
    });

    if (variants.length !== variantIds.length) {
      return NextResponse.json(
        { error: 'Uma ou mais variantes não foram encontradas' },
        { status: 400 },
      );
    }

    for (const item of data.items) {
      const variant = variants.find((v) => v.id === item.variantId);
      if (!variant) continue;
      if (variant.stockQuantity < item.quantity) {
        return NextResponse.json(
          {
            error: `Estoque insuficiente: ${variant.product.name} (${variant.size.name}/${variant.color.name}). Disponível: ${variant.stockQuantity}, pedido: ${item.quantity}`,
          },
          { status: 400 },
        );
      }
    }

    // ========== paymentStatus ==========
    const cashAmount = total - fiadoAmount;
    let paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING' = 'PAID';
    if (fiadoAmount > 0 && cashAmount > 0) paymentStatus = 'PARTIAL';
    else if (fiadoAmount > 0 && cashAmount === 0) paymentStatus = 'PENDING';

    // ========== TRANSAÇÃO ==========
    const sale = await prisma.$transaction(async (tx) => {
      // 1. Criar venda
      const newSale = await tx.sale.create({
        data: {
          customerId: data.customerId || null,
          userId: user.userId,
          subtotal,
          discountAmount: data.discount,
          total,
          amountPaid: cashAmount,
          status: 'COMPLETED',
          paymentStatus,
          notes: data.notes || null,
          items: {
            create: data.items.map((item) => {
              const variant = variants.find((v) => v.id === item.variantId)!;
              const lineTotal = item.unitPrice * item.quantity - item.discount;
              return {
                variantId: item.variantId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                unitCost: variant.costPrice,
                discountAmount: item.discount,
                subtotal: lineTotal,
              };
            }),
          },
          payments: {
            create: data.payments.map((p) => ({
              method: p.method as PaymentMethod,
              amount: p.amount,
              installments: p.installments,
            })),
          },
        },
        include: {
          items: { include: { variant: { include: { product: true, size: true, color: true } } } },
          payments: true,
          customer: { select: { id: true, name: true } },
        },
      });

      // 2. Descontar estoque + registrar movimentação
      for (const item of data.items) {
        const variant = variants.find((v) => v.id === item.variantId)!;
        const newStock = variant.stockQuantity - item.quantity;

        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: newStock },
        });

        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            type: 'SALE',
            quantity: -item.quantity,
            balanceAfter: newStock,
            referenceType: 'sale',
            referenceId: newSale.id,
            reason: `Venda #${newSale.saleNumber}`,
            userId: user.userId,
          },
        });
      }

      // 3. Criar parcelas e atualizar dívida (se fiado)
      if (hasFiado && data.customerId) {
        for (const payment of newSale.payments) {
          if (payment.method === 'CREDIT_NOTE') {
            const installmentValue = Number(payment.amount) / payment.installments;
            for (let i = 0; i < payment.installments; i++) {
              const dueDate = new Date();
              dueDate.setMonth(dueDate.getMonth() + i + 1);
              await tx.installment.create({
                data: {
                  saleId: newSale.id,
                  customerId: data.customerId,
                  installmentNumber: i + 1,
                  totalInstallments: payment.installments,
                  amount: installmentValue,
                  dueDate,
                  status: 'PENDING',
                },
              });
            }
          }
        }

        await tx.customer.update({
          where: { id: data.customerId },
          data: { currentDebt: { increment: fiadoAmount } },
        });
      }

      // 4. Registrar fluxo de caixa
      const cashFlowEntries = data.payments
        .filter((p) => p.method !== 'CREDIT_NOTE')
        .map((p) => ({
          type: 'INCOME' as const,
          source: 'SALE' as const,
          amount: p.amount,
          description: `Venda #${newSale.saleNumber} - ${methodLabel(p.method)}`,
          occurredAt: new Date(),
          saleId: newSale.id,
          userId: user.userId,
          paymentMethod: p.method as PaymentMethod,
        }));

      if (cashFlowEntries.length > 0) {
        await tx.cashFlow.createMany({ data: cashFlowEntries });
      }

      return newSale;
    });

    return NextResponse.json(
      {
        sale: {
          ...sale,
          subtotal: Number(sale.subtotal),
          discountAmount: Number(sale.discountAmount),
          total: Number(sale.total),
          amountPaid: Number(sale.amountPaid),
          items: sale.items.map((i) => ({
            ...i,
            unitPrice: Number(i.unitPrice),
            unitCost: Number(i.unitCost),
            discountAmount: Number(i.discountAmount),
            subtotal: Number(i.subtotal),
          })),
          payments: sale.payments.map((p) => ({
            ...p,
            amount: Number(p.amount),
          })),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Erro ao criar venda:', error);
    return NextResponse.json(
      { error: 'Erro ao processar venda. Tente novamente.' },
      { status: 500 },
    );
  }
}

function methodLabel(method: string): string {
  const map: Record<string, string> = {
    PIX: 'Pix',
    DEBIT: 'Débito',
    CREDIT: 'Crédito',
    CASH: 'Dinheiro',
    CREDIT_NOTE: 'Fiado',
  };
  return map[method] ?? method;
}
