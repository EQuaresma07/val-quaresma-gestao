/**
 * POST /api/sales/[id]/cancel
 *
 * Cancela uma venda completa (até 24h após criação).
 * Reverte tudo:
 *   - Status → CANCELLED
 *   - Devolve estoque das variantes
 *   - Registra stock_movement de retorno
 *   - Estorna dívida do cliente (se fiado)
 *   - Cria entradas negativas no cash_flow
 *   - Cancela parcelas pendentes
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

const CANCEL_WINDOW_HOURS = 24;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = ((body.reason ?? '') as string).trim() || 'Cancelamento solicitado';

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: true,
        payments: true,
        installments: true,
      },
    });

    if (!sale) {
      return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 });
    }

    if (sale.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Venda já cancelada' }, { status: 400 });
    }

    // Janela de cancelamento
    const hoursElapsed =
      (Date.now() - new Date(sale.saleDate).getTime()) / (1000 * 60 * 60);
    if (hoursElapsed > CANCEL_WINDOW_HOURS) {
      return NextResponse.json(
        {
          error: `Janela de cancelamento expirou (${CANCEL_WINDOW_HOURS}h). Faça uma devolução pelo admin.`,
        },
        { status: 400 },
      );
    }

    // Verificar se alguma parcela já foi paga
    const paidInstallments = sale.installments.filter((i) => i.status === 'PAID');
    if (paidInstallments.length > 0) {
      return NextResponse.json(
        { error: 'Não é possível cancelar: existem parcelas já pagas' },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      // 1. Atualizar status e adicionar motivo nas notas
      const cancelNote = `[CANCELADA em ${new Date().toLocaleString('pt-BR')}] ${reason}`;
      await tx.sale.update({
        where: { id: sale.id },
        data: {
          status: 'CANCELLED',
          notes: sale.notes ? `${sale.notes}\n${cancelNote}` : cancelNote,
        },
      });

      // 2. Devolver estoque
      for (const item of sale.items) {
        const variant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          select: { stockQuantity: true },
        });
        if (!variant) continue;

        const newStock = variant.stockQuantity + item.quantity;
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: newStock },
        });

        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            type: 'RETURN_IN',
            quantity: item.quantity,
            balanceAfter: newStock,
            referenceType: 'sale_cancellation',
            referenceId: sale.id,
            reason: `Cancelamento da venda #${sale.saleNumber}`,
            userId: user.userId,
          },
        });
      }

      // 3. Estornar dívida do cliente
      const fiadoTotal = sale.payments
        .filter((p) => p.method === 'CREDIT_NOTE')
        .reduce((acc, p) => acc + Number(p.amount), 0);

      if (fiadoTotal > 0 && sale.customerId) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { currentDebt: { decrement: fiadoTotal } },
        });
      }

      // 4. Cancelar parcelas pendentes
      await tx.installment.updateMany({
        where: { saleId: sale.id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });

      // 5. Registrar saídas no cash_flow (estorno)
      const cashEntries = sale.payments
        .filter((p) => p.method !== 'CREDIT_NOTE')
        .map((p) => ({
          type: 'EXPENSE' as const,
          source: 'RETURN' as const,
          amount: Number(p.amount),
          description: `Cancelamento da venda #${sale.saleNumber}`,
          occurredAt: new Date(),
          saleId: sale.id,
          userId: user.userId,
          paymentMethod: p.method,
        }));

      if (cashEntries.length > 0) {
        await tx.cashFlow.createMany({ data: cashEntries });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro ao cancelar venda:', error);
    return NextResponse.json(
      { error: 'Erro ao cancelar venda' },
      { status: 500 },
    );
  }
}
