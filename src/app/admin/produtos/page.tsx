'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Product {
  id: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  totalStock: number;
  variantCount: number;
  minPrice: number;
  maxPrice: number;
  category: { id: string; name: string };
  isActive: boolean;
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadProducts(searchTerm = '') {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchTerm) params.set('search', searchTerm);
    const res = await fetch(`/api/products?${params}`);
    const data = await res.json();
    setProducts(data.products ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  // Debounce na busca
  useEffect(() => {
    const t = setTimeout(() => loadProducts(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? 'Erro ao deletar');
      } else {
        setProducts((prev) => prev.filter((p) => p.id !== deleteId));
      }
    } finally {
      setDeleteId(null);
      setDeleting(false);
    }
  }

  const productToDelete = products.find((p) => p.id === deleteId);

  return (
    <div style={S.page}>
      {/* HEADER */}
      <header style={S.header}>
        <div>
          <h1 style={S.title}>Produtos</h1>
          <p style={S.subtitle}>{products.length} produto{products.length !== 1 ? 's' : ''} cadastrado{products.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/admin/produtos/novo" style={S.btnPrimary}>
          + Novo Produto
        </Link>
      </header>

      {/* BUSCA */}
      <div style={S.searchWrap}>
        <span style={S.searchIcon}>⌕</span>
        <input
          type="text"
          placeholder="Buscar por nome, marca ou SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={S.searchInput}
        />
      </div>

      {/* LISTAGEM */}
      {loading ? (
        <div style={S.empty}>
          <div style={{ color: 'var(--text-muted)' }}>Carregando...</div>
        </div>
      ) : products.length === 0 ? (
        <div style={S.empty}>
          <div style={S.emptyIcon}>◈</div>
          <div style={S.emptyText}>
            {search ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado ainda'}
          </div>
          {!search && (
            <Link href="/admin/produtos/novo" style={{ ...S.btnPrimary, marginTop: 16 }}>
              + Cadastrar Primeiro Produto
            </Link>
          )}
        </div>
      ) : (
        <div style={S.grid}>
          {products.map((p) => (
            <div key={p.id} style={S.card}>
              <div style={S.cardImage}>
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} style={S.cardImg} />
                ) : (
                  <span style={{ fontSize: 32, color: 'var(--text-dim)' }}>◈</span>
                )}
              </div>
              <div style={S.cardBody}>
                <div style={S.cardName}>{p.name}</div>
                <div style={S.cardMeta}>
                  {p.category.name} {p.brand ? `· ${p.brand}` : ''}
                </div>
                <div style={S.cardFooter}>
                  <div>
                    <div style={S.price}>
                      {p.minPrice === p.maxPrice
                        ? formatBRL(p.minPrice)
                        : `${formatBRL(p.minPrice)} – ${formatBRL(p.maxPrice)}`}
                    </div>
                    <div style={{ ...S.stock, color: p.totalStock < 5 ? 'var(--red)' : 'var(--text-muted)' }}>
                      {p.totalStock} un. · {p.variantCount} variante{p.variantCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div style={S.cardActions}>
                  <button
                    onClick={() => router.push(`/admin/produtos/${p.id}`)}
                    style={S.btnGhost}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => router.push(`/admin/produtos/${p.id}/variants`)}
                    style={S.btnGhost}
                  >
                    Variantes
                  </button>
                  <button onClick={() => setDeleteId(p.id)} style={S.btnDanger}>
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO */}
      {deleteId && productToDelete && (
        <div style={S.modalOverlay} onClick={() => !deleting && setDeleteId(null)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={S.modalTitle}>Confirmar exclusão</h3>
            <p style={S.modalText}>
              Tem certeza que deseja excluir <strong>{productToDelete.name}</strong>?
            </p>
            <p style={S.modalHint}>
              O produto e suas variantes serão arquivados (soft delete). O histórico de vendas é preservado.
            </p>
            <div style={S.modalActions}>
              <button onClick={() => setDeleteId(null)} style={S.btnGhost} disabled={deleting}>
                Cancelar
              </button>
              <button onClick={handleDelete} style={S.btnDanger} disabled={deleting}>
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: 32, color: 'var(--text)' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 24,
    gap: 16,
    flexWrap: 'wrap',
  },
  title: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 24,
    fontWeight: 600,
    marginBottom: 4,
  },
  subtitle: { color: 'var(--text-muted)', fontSize: 13 },
  btnPrimary: {
    background: 'var(--accent)',
    color: '#0F0F0F',
    padding: '10px 18px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
    fontFamily: "'DM Sans', sans-serif",
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0 14px',
    height: 42,
    marginBottom: 20,
    maxWidth: 480,
  },
  searchIcon: { color: 'var(--text-dim)', fontSize: 16 },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--text)',
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
  },
  empty: {
    textAlign: 'center',
    padding: '64px 20px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
  },
  emptyIcon: { fontSize: 36, color: 'var(--text-dim)', marginBottom: 12 },
  emptyText: { fontSize: 14, color: 'var(--text-muted)' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 16,
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  cardImage: {
    width: '100%',
    aspectRatio: '1',
    background: 'var(--bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottom: '1px solid var(--border)',
    overflow: 'hidden',
  },
  cardImg: { width: '100%', height: '100%', objectFit: 'cover' as const },
  cardBody: { padding: 16, flex: 1, display: 'flex', flexDirection: 'column' },
  cardName: { fontSize: 14, fontWeight: 500, marginBottom: 4 },
  cardMeta: {
    fontSize: 11,
    color: 'var(--text-dim)',
    fontFamily: "'DM Mono', monospace",
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardFooter: { marginBottom: 12, marginTop: 'auto' as const },
  price: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 16,
    color: 'var(--accent)',
    fontWeight: 600,
  },
  stock: {
    fontSize: 11,
    fontFamily: "'DM Mono', monospace",
    marginTop: 4,
  },
  cardActions: {
    display: 'flex',
    gap: 6,
    paddingTop: 12,
    borderTop: '1px solid var(--border)',
  },
  btnGhost: {
    flex: 1,
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    padding: '6px 8px',
    borderRadius: 6,
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  btnDanger: {
    flex: 1,
    background: 'transparent',
    color: '#C86E6E',
    border: '1px solid #C86E6E55',
    padding: '6px 8px',
    borderRadius: 6,
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: 20,
  },
  modal: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 28,
    maxWidth: 420,
    width: '100%',
  },
  modalTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 18,
    marginBottom: 12,
  },
  modalText: { fontSize: 14, color: 'var(--text)', marginBottom: 8 },
  modalHint: {
    fontSize: 12,
    color: 'var(--text-dim)',
    marginBottom: 20,
    fontFamily: "'DM Mono', monospace",
  },
  modalActions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
};
