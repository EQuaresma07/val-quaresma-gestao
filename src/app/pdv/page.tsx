import { getCurrentUser } from '@/lib/auth';

export default async function PDVPage() {
  const user = await getCurrentUser();

  return (
    <div style={{ padding: 40, color: 'var(--text)' }}>
      <h1 style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: 28,
        color: 'var(--accent)',
        marginBottom: 8,
      }}>
        PDV — Ponto de Venda
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
        Operador: {user?.name}
      </p>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: 24,
        color: 'var(--text-muted)',
      }}>
        A interface do PDV (já desenhada em <code>loja-pdv.jsx</code>) será integrada aqui na próxima etapa.
      </div>
      <p style={{ marginTop: 20 }}>
        <a href="/admin" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          ← Voltar ao Admin
        </a>
      </p>
    </div>
  );
}
