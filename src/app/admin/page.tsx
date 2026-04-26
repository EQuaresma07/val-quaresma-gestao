import { getCurrentUser } from '@/lib/auth';
import LogoutButton from './_components/LogoutButton';

export default async function AdminPage() {
  const user = await getCurrentUser();

  return (
    <div style={{ padding: 40, color: 'var(--text)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
        <div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 28,
            color: 'var(--accent)',
            marginBottom: 4,
          }}>
            Atelier — Administrativo
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Bem-vindo, {user?.name}
          </p>
        </div>
        <LogoutButton />
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        <Card title="Dashboard" desc="KPIs, gráficos e atividade recente" href="/admin/dashboard" />
        <Card title="Produtos" desc="Cadastro de produtos e variantes" href="/admin/produtos" />
        <Card title="Estoque" desc="Posição e movimentação de estoque" href="/admin/estoque" />
        <Card title="Vendas" desc="Histórico de vendas" href="/admin/vendas" />
        <Card title="Clientes" desc="Cadastro e histórico" href="/admin/clientes" />
        <Card title="Fornecedores" desc="Cadastro e pedidos" href="/admin/fornecedores" />
        <Card title="Financeiro" desc="Fluxo de caixa" href="/admin/financeiro" />
        <Card title="PDV" desc="Ponto de venda" href="/pdv" highlight />
      </div>

      <p style={{ marginTop: 40, color: 'var(--text-dim)', fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
        Setup completo. As telas serão implementadas a seguir.
      </p>
    </div>
  );
}

function Card({ title, desc, href, highlight }: { title: string; desc: string; href: string; highlight?: boolean }) {
  return (
    <a
      href={href}
      style={{
        display: 'block',
        background: highlight ? 'var(--accent-dim)' : 'var(--surface)',
        border: `1px solid ${highlight ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 10,
        padding: 20,
        textDecoration: 'none',
        color: 'var(--text)',
        transition: 'all 0.15s',
      }}
    >
      <h3 style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: 16,
        marginBottom: 6,
        color: highlight ? 'var(--accent)' : 'var(--text)',
      }}>
        {title}
      </h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{desc}</p>
    </a>
  );
}
