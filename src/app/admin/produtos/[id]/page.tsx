import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ProductForm from '../../_components/ProductForm';

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = await prisma.product.findFirst({
    where: { id, deletedAt: null },
  });

  if (!product) notFound();

  const initialData = {
    name: product.name,
    description: product.description ?? '',
    brand: product.brand ?? '',
    gender: product.gender,
    categoryId: product.categoryId,
    suggestedPrice: String(product.suggestedPrice),
    imageUrl: product.imageUrl ?? '',
    sku: product.sku ?? '',
    barcode: product.barcode ?? '',
  };

  return (
    <div style={{ padding: 32, color: 'var(--text)' }}>
      <Link
        href="/admin/produtos"
        style={{
          color: 'var(--text-muted)',
          fontSize: 12,
          textDecoration: 'none',
          fontFamily: "'DM Mono', monospace",
        }}
      >
        ← Voltar
      </Link>
      <h1
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 24,
          fontWeight: 600,
          marginTop: 12,
          marginBottom: 4,
        }}
      >
        Editar Produto
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
        {product.name}
      </p>
      <ProductForm initialData={initialData} productId={product.id} />
    </div>
  );
}
