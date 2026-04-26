import Link from 'next/link';

export default function AdminPage() {
  return (
    <div style={{ padding: 32 }}>
      <header style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 24,
            color: 'var(--text)',
            fontWeight: 600,
          }}
        >
          Bem-vindo
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          Painel administrativo da loja
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 16,
        }}
      >
        <Card title="Produtos" desc="Cadastro de produtos e variantes" href="/admin/produtos" available />
        <Card title="Estoque" desc="Posição e movimentação de estoque" href="/admin/estoque" />
        <Card title="Vendas" desc="Histórico de vendas" href="/admin/vendas" />
        <Card title="Clientes" desc="Cadastro e histórico" href="/admin/clientes" />
        <Card title="Fornecedores" desc="Cadastro e pedidos" href="/admin/fornecedores" />
        <Card title="Financeiro" desc="Fluxo de caixa" href="/admin/financeiro" />
      </div>
    </div>
  );
}

function Card({
  title,
  desc,
  href,
  available,
}: {
  title: string;
  desc: string;
  href: string;
  available?: boolean;
}) {
  const content = (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${available ? '#C8A96E44' : 'var(--border)'}`,
        borderRadius: 10,
        padding: 20,
        opacity: available ? 1 : 0.5,
        cursor: available ? 'pointer' : 'not-allowed',
      }}
    >
      <h3
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 16,
          marginBottom: 6,
          color: available ? 'var(--accent)' : 'var(--text)',
        }}
      >
        {title}
      </h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{desc}</p>
      {!available && (
        <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 8, fontFamily: "'DM Mono', monospace" }}>
          Em breve
        </p>
      )}
    </div>
  );

  if (available) return <Link href={href} style={{ textDecoration: 'none' }}>{content}</Link>;
  return <div>{content}</div>;
}
