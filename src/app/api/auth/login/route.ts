/**
 * POST /api/auth/login
 *
 * Body: { email: string, password: string }
 * Retorna: { user: { id, name, email, role } } + cookie HttpOnly
 *
 * Segurança:
 * - Validação de input com zod
 * - Mensagens genéricas de erro (não revela se email existe)
 * - Sem retornar passwordHash em nenhuma circunstância
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  verifyPassword,
  createToken,
  setSessionCookie,
} from '@/lib/auth';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Erro genérico — não expõe se o email existe
    const invalidMsg = 'Email ou senha incorretos';

    if (!user || user.deletedAt || !user.isActive) {
      return NextResponse.json({ error: invalidMsg }, { status: 401 });
    }

    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      return NextResponse.json({ error: invalidMsg }, { status: 401 });
    }

    // Atualizar último login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Criar token e gravar cookie
    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 },
    );
  }
}
