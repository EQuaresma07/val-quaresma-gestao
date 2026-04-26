import Link from 'next/link';
import ProductForm from '../../_components/ProductForm';

export default function NovoProdutoPage() {
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
        Novo Produto
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
        Cadastre o produto e suas variantes
      </p>
      <ProductForm />
    </div>
  );
}
