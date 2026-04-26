/**
 * Schemas Zod centralizados para validação de produtos e variantes.
 */

import { z } from 'zod';

export const variantSchema = z.object({
  sizeId: z.string().uuid('Tamanho inválido'),
  colorId: z.string().uuid('Cor inválida'),
  sku: z.string().min(1, 'SKU obrigatório').max(60),
  barcode: z.string().max(60).optional().or(z.literal('')),
  costPrice: z.number().nonnegative('Custo não pode ser negativo'),
  sellingPrice: z.number().positive('Preço deve ser maior que zero'),
  stockQuantity: z.number().int().nonnegative().default(0),
  minStockAlert: z.number().int().nonnegative().default(3),
});

export const productSchema = z.object({
  name: z.string().min(2, 'Nome muito curto').max(150),
  description: z.string().max(2000).optional().or(z.literal('')),
  brand: z.string().max(80).optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'UNISEX', 'KIDS']),
  categoryId: z.string().uuid('Categoria inválida'),
  suggestedPrice: z.number().positive('Preço sugerido deve ser maior que zero'),
  imageUrl: z.string().url().optional().or(z.literal('')),
  sku: z.string().max(50).optional().or(z.literal('')),
  barcode: z.string().max(50).optional().or(z.literal('')),
  variants: z.array(variantSchema).min(1, 'Adicione pelo menos uma variante'),
});

export const productUpdateSchema = productSchema
  .omit({ variants: true })
  .partial();

export type ProductInput = z.infer<typeof productSchema>;
export type VariantInput = z.infer<typeof variantSchema>;
