'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Variant {
  id: string;
  sku: string;
  barcode: string | null;
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  minStockAlert: number;
  isActive: boolean;
  size: { id: string; name: string };
  color: { id: string; name: string; hexCode: string | null };
}

interface Size { id: string; name: string; }
interface Color { id: string; name: string; hexCode: string | null; }

export default function VariantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: productId } = use(params);
  const router = useRouter();

  const [productName, setProductName] = useState('');
  const [variants, setVariants] = useState<Variant[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form de edição
  const [editForm, setEditForm] = useState({
    sku: '',
    barcode: '',
    costPrice: '',
    sellingPrice: '',
    minStockAlert: '',
    sizeId: '',
    colorId: '',
  });

  // Form de adicionar variante nova
  const [newVariant, setNewVariant] = useState({
    sizeId: '',
    colorId: '',
    sku: '',
    barcode: '',
    costPrice: '',
    sellingPrice: '',
    stockQuantity: '0',
    minStockAlert: '3',
  });

  async function loadData() {
    setLoading(true);
    const [prodRes, sizesRes, colorsRes] = await Promise.all([
      fetch(`/api/products/${productId}`),
      fetch('/api/sizes'),
      fetch('/api/colors'),
    ]);
    const prodData = await prodRes.json();
    const sizesData = await sizesRes.json();
    const colorsData = await colorsRes.json();

    if (prodData.product) {
      setProductName(prodData.product.name);
      setVariants(prodData.product.variants ?? []);
    }
    setSizes(sizesData.sizes ?? []);
    setColors(colorsData.colors ?? []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [productId]);

  function startEdit(v: Variant) {
    setEditingId(v.id);
    setEditForm({
      sku: v.sku,
      barcode: v.barcode ?? '',
      costPrice: String(v.costPrice),
      sellingPrice: String(v.sellingPrice),
      minStockAlert: String(v.minStockAlert),
      sizeId: v.size.id,
      colorId: v.color.id,
    });
    setError(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    setError(null);

    try {
      const cost = parseFloat(editForm.costPrice);
      const selling = parseFloat(editForm.sellingPrice);
      if (isNaN(cost) || cost < 0) throw new Error('Custo inválido');
      if (!selling || selling <= 0) throw new Error('Preço de venda inválido');

      const res = await fetch(`/api/products/${productId}/variants/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: editForm.sku.trim(),
          barcode: editForm.barcode.trim() || '',
          costPrice: cost,
          sellingPrice: selling,
          minStockAlert: parseInt(editForm.minStockAlert) || 3,
          sizeId: editForm.sizeId,
          colorId: editForm.colorId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar');
      setEditingId(null);
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro';
      setError(message);
    }
  }

  async function deleteVariant(variantId: string) {
    if (!confirm('Excluir esta variante? O estoque será arquivado.')) return;
    try {
      const res = await fetch(`/api/products/${productId}/variants/${variantId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? 'Erro ao excluir');
        return;
      }
      loadData();
    } catch {
      alert('Erro ao excluir');
    }
  }

  async function addVariant() {
    setError(null);
    try {
      if (!newVariant.sizeId) throw new Error('Selecione tamanho');
      if (!newVariant.colorId) throw new Error('Selecione cor');
      if (!newVariant.sku.trim()) throw new Error('SKU obrigatório');

      const cost = parseFloat(newVariant.costPrice);
      const selling = parseFloat(newVariant.sellingPrice);
      if (isNaN(cost) || cost < 0) throw new Error('Custo inválido');
      if (!selling || selling <= 0) throw new Error('Preço de venda inválido');

      const res = await fetch(`/api/products/${productId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sizeId: newVariant.sizeId,
          colorId: newVariant.colorId,
          sku: newVariant.sku.trim(),
          barcode: newVariant.barcode.trim() || '',
          costPrice: cost,
          sellingPrice: selling,
          stockQuantity: parseInt(newVariant.stockQuantity) || 0,
          minStockAlert: parseInt(newVariant.minStockAlert) || 3,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao adicionar');

      setShowAddForm(false);
      setNewVariant({
        sizeId: '', colorId: '', sku: '', barcode: '',
        costPrice: '', sellingPrice: '', stockQuantity: '0', minStockAlert: '3',
      });
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro';
      setError(message);
    }
  }

  return (
    <div style={{ padding: 32, color: 'var(--text)' }}>
      <Link
        href="/admin/produtos"
        style={{ color: 'var(--text-muted)', fontSize: 12, textDecoration: 'none', fontFamily: "'DM Mono', monospace" }}
      >
        ← Produtos
      </Link>

      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 12,
        marginBottom: 24,
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
            Variantes
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{productName}</p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} style={S.btnPrimary}>
          {showAddForm ? '✕ Cancelar' : '+ Nova variante'}
        </button>
      </header>

      {showAddForm && (
        <div style={{ ...S.card, marginBottom: 20, borderColor: 'var(--accent)' }}>
          <h3 style={S.cardTitle}>Adicionar nova variante</h3>

          <div style={S.row3}>
            <FieldLabel label="Tamanho">
              <select
                value={newVariant.sizeId}
                onChange={(e) => setNewVariant({ ...newVariant, sizeId: e.target.value })}
                style={S.input}
              >
                <option value="">—</option>
                {sizes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FieldLabel>
            <FieldLabel label="Cor">
              <select
                value={newVariant.colorId}
                onChange={(e) => setNewVariant({ ...newVariant, colorId: e.target.value })}
                style={S.input}
              >
                <option value="">—</option>
                {colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FieldLabel>
            <FieldLabel label="SKU">
              <input
                type="text"
                value={newVariant.sku}
                onChange={(e) => setNewVariant({ ...newVariant, sku: e.target.value })}
                style={S.input}
                placeholder="VEST-FLOR-G-FLOR"
              />
            </FieldLabel>
          </div>

          <div style={S.row3}>
            <FieldLabel label="Custo">
              <input
                type="number"
                step="0.01"
                value={newVariant.costPrice}
                onChange={(e) => setNewVariant({ ...newVariant, costPrice: e.target.value })}
                style={S.input}
                placeholder="0,00"
              />
            </FieldLabel>
            <FieldLabel label="Preço venda">
              <input
                type="number"
                step="0.01"
                value={newVariant.sellingPrice}
                onChange={(e) => setNewVariant({ ...newVariant, sellingPrice: e.target.value })}
                style={S.input}
                placeholder="0,00"
              />
            </FieldLabel>
            <FieldLabel label="Estoque inicial">
              <input
                type="number"
                value={newVariant.stockQuantity}
                onChange={(e) => setNewVariant({ ...newVariant, stockQuantity: e.target.value })}
                style={S.input}
              />
            </FieldLabel>
          </div>

          {error && <div style={S.error}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button onClick={() => { setShowAddForm(false); setError(null); }} style={S.btnGhost}>
              Cancelar
            </button>
            <button onClick={addVariant} style={S.btnPrimary}>
              Adicionar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          Carregando...
        </div>
      ) : variants.length === 0 ? (
        <div style={S.empty}>
          <div style={{ fontSize: 32, color: 'var(--text-dim)', marginBottom: 12 }}>⬡</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            Nenhuma variante cadastrada
          </div>
        </div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={S.th}>Tamanho</th>
                <th style={S.th}>Cor</th>
                <th style={S.th}>SKU</th>
                <th style={S.th}>Custo</th>
                <th style={S.th}>Preço venda</th>
                <th style={S.th}>Estoque</th>
                <th style={S.th}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => {
                const isEditing = editingId === v.id;
                if (isEditing) {
                  return (
                    <tr key={v.id} style={{ background: 'var(--accent-dim)' }}>
                      <td style={S.td}>
                        <select
                          value={editForm.sizeId}
                          onChange={(e) => setEditForm({ ...editForm, sizeId: e.target.value })}
                          style={{ ...S.input, padding: '6px 8px', fontSize: 12 }}
                        >
                          {sizes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </td>
                      <td style={S.td}>
                        <select
                          value={editForm.colorId}
                          onChange={(e) => setEditForm({ ...editForm, colorId: e.target.value })}
                          style={{ ...S.input, padding: '6px 8px', fontSize: 12 }}
                        >
                          {colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td style={S.td}>
                        <input
                          type="text"
                          value={editForm.sku}
                          onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                          style={{ ...S.input, padding: '6px 8px', fontSize: 12 }}
                        />
                      </td>
                      <td style={S.td}>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.costPrice}
                          onChange={(e) => setEditForm({ ...editForm, costPrice: e.target.value })}
                          style={{ ...S.input, padding: '6px 8px', fontSize: 12 }}
                        />
                      </td>
                      <td style={S.td}>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.sellingPrice}
                          onChange={(e) => setEditForm({ ...editForm, sellingPrice: e.target.value })}
                          style={{ ...S.input, padding: '6px 8px', fontSize: 12 }}
                        />
                      </td>
                      <td style={S.td}>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: 'var(--text-muted)' }}>
                          {v.stockQuantity}
                        </span>
                      </td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={saveEdit} style={S.btnSave}>✓</button>
                          <button onClick={() => { setEditingId(null); setError(null); }} style={S.btnCancel}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={v.id}>
                    <td style={S.td}><span style={S.tag}>{v.size.name}</span></td>
                    <td style={S.td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {v.color.hexCode && (
                          <span style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: v.color.hexCode,
                            border: '1px solid var(--border)',
                            display: 'inline-block',
                          }} />
                        )}
                        {v.color.name}
                      </span>
                    </td>
                    <td style={{ ...S.td, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                      {v.sku}
                    </td>
                    <td style={{ ...S.td, fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
                      {formatBRL(v.costPrice)}
                    </td>
                    <td style={{ ...S.td, fontFamily: "'Playfair Display', serif", color: 'var(--accent)' }}>
                      {formatBRL(v.sellingPrice)}
                    </td>
                    <td style={S.td}>
                      <span style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 13,
                        fontWeight: 500,
                        color: v.stockQuantity < v.minStockAlert ? '#C86E6E' : 'var(--text)',
                      }}>
                        {v.stockQuantity}
                      </span>
                    </td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => startEdit(v)} style={S.btnAction}>Editar</button>
                        <button onClick={() => deleteVariant(v.id)} style={S.btnDanger}>×</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {error && editingId && (
            <div style={{ ...S.error, margin: 16 }}>{error}</div>
          )}
        </div>
      )}
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontSize: 10,
        color: 'var(--text-dim)',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        fontFamily: "'DM Mono', monospace",
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const S: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 20,
  },
  cardTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 15,
    marginBottom: 14,
  },
  row3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 },
  input: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '10px 12px',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
    width: '100%',
  },
  empty: {
    textAlign: 'center',
    padding: 60,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
  },
  tableWrap: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    overflow: 'auto',
  },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: {
    padding: '12px 16px',
    textAlign: 'left' as const,
    fontSize: 10,
    fontFamily: "'DM Mono', monospace",
    color: 'var(--text-dim)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: 400,
  },
  td: {
    padding: '12px 16px',
    fontSize: 13,
    color: 'var(--text)',
    borderBottom: '1px solid #2A2A2A88',
  },
  tag: {
    display: 'inline-block',
    padding: '3px 9px',
    borderRadius: 20,
    fontSize: 11,
    background: 'var(--bg)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    fontFamily: "'DM Mono', monospace",
  },
  btnAction: {
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    padding: '4px 10px',
    borderRadius: 5,
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  btnDanger: {
    background: 'transparent',
    color: '#C86E6E',
    border: '1px solid #C86E6E55',
    padding: '4px 8px',
    borderRadius: 5,
    fontSize: 11,
    cursor: 'pointer',
  },
  btnSave: {
    background: 'var(--accent)',
    color: '#0F0F0F',
    border: 'none',
    padding: '4px 10px',
    borderRadius: 5,
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: 600,
  },
  btnCancel: {
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    padding: '4px 10px',
    borderRadius: 5,
    fontSize: 12,
    cursor: 'pointer',
  },
  btnPrimary: {
    background: 'var(--accent)',
    color: '#0F0F0F',
    border: 'none',
    padding: '10px 18px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  btnGhost: {
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    padding: '10px 18px',
    borderRadius: 8,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  error: {
    background: '#C86E6E22',
    border: '1px solid #C86E6E55',
    color: '#C86E6E',
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 12,
    marginTop: 12,
  },
};
