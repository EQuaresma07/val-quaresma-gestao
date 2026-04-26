/**
 * Cliente Cloudinary para upload de imagens.
 *
 * Configurar no .env:
 * CLOUDINARY_CLOUD_NAME=seu-cloud
 * CLOUDINARY_API_KEY=sua-key
 * CLOUDINARY_API_SECRET=seu-secret
 */

import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

/**
 * Faz upload de uma imagem (vinda como base64 data URL ou buffer).
 * Retorna a URL pública da imagem.
 */
export async function uploadImage(
  fileDataUrl: string,
  folder = 'atelier/products',
): Promise<string> {
  const result = await cloudinary.uploader.upload(fileDataUrl, {
    folder,
    transformation: [
      { width: 800, height: 800, crop: 'limit' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  });
  return result.secure_url;
}

/**
 * Remove uma imagem do Cloudinary baseado na URL.
 */
export async function deleteImage(url: string): Promise<void> {
  try {
    // Extrai o public_id da URL: .../upload/v123/folder/name.jpg → folder/name
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
    if (!match) return;
    const publicId = match[1];
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Erro ao deletar imagem:', error);
  }
}
