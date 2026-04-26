/**
 * POST /api/upload
 *
 * Recebe uma imagem em base64 e faz upload para o Cloudinary.
 * Retorna a URL pública.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { uploadImage } from '@/lib/cloudinary';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.image || typeof body.image !== 'string') {
      return NextResponse.json(
        { error: 'Imagem ausente ou inválida' },
        { status: 400 },
      );
    }

    // Validar formato base64
    if (!body.image.startsWith('data:image/')) {
      return NextResponse.json(
        { error: 'Formato de imagem inválido' },
        { status: 400 },
      );
    }

    const url = await uploadImage(body.image);

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Erro no upload:', error);
    return NextResponse.json(
      { error: 'Erro ao fazer upload da imagem' },
      { status: 500 },
    );
  }
}