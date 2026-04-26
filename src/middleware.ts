/**
 * MIDDLEWARE GLOBAL — Proteção de rotas
 *
 * Roda ANTES de cada request nas rotas protegidas.
 * Verifica o JWT do cookie e:
 * - Se inválido/ausente → redireciona pra /login
 * - Se válido → deixa passar
 *
 * Também redireciona usuários LOGADOS que tentam acessar /login → /admin
 *
 * Importante: o middleware roda no Edge Runtime, então usa `jose` (não bcrypt).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'atelier_session';

const PROTECTED_PATHS = ['/admin', '/pdv'];
const AUTH_PATHS = ['/login'];

async function isAuthenticated(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const secret = process.env.JWT_SECRET;
  if (!secret) return false;

  try {
    await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
    });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isAuthPath = AUTH_PATHS.some((p) => pathname.startsWith(p));

  const authenticated = await isAuthenticated(token);

  // Tentando acessar rota protegida sem autenticação → login
  if (isProtected && !authenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  // Já logado tentando acessar /login → admin
  if (isAuthPath && authenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Aplica em todas as rotas EXCETO:
     * - /api/* (a auth da API é feita dentro de cada handler)
     * - /_next/* (assets)
     * - arquivos estáticos
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
