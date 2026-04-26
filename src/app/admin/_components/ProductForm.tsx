'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Category { id: string; name: string; parent: { id: string; name: string } | null; }
interface Size { id: string; name: string; displayOrder: number; }
interface Color { id: string; name: string; hexCode: string | null; }

interface VariantForm {
  tempId: string;
  sizeId: string;
  colorId: string;
  sku: string;
  barcode: string;
  costPrice: string;
  sellingPrice: string;
  stockQuantity: string;
  minStockAlert: string;
}

interface ProductFormData {
  name: string;
  description: string;
  brand: string;
  gender: 'MALE' | 'FEMALE' | 'UNISEX' | 'KIDS';
  categoryId: string;
  suggestedPrice: string;
  imageUrl: string;
  sku: string;
  barcode: string;
  variants: VariantForm[];
}

interface Props {
  initialData?: Partial<ProductFormData>;
  productId?: string; // se vier, é edição
}

export default function ProductForm({ initialData, productId }: Props) {
  const router = useRouter();
  const isEdit = !!productId;

  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<ProductFormData>({
    name: initialData?.name ?? '',
    description: initialData?.description ?? '',
    brand: initialData?.brand ?? '',
    gender: initialData?.gender ?? 'UNISEX',
    categoryId: initialData?.categoryId ?? '',
    suggestedPrice: initialData?.suggestedPrice ?? '',
    imageUrl: initialData?.imageUrl ?? '',
    sku: initialData?.sku ?? '',
    barcode: initialData?.barcode ?? '',
    variants: initialData?.variants ?? [
      {
        tempId: cryptoId(),
        sizeId: '',
        colorId: '',
        sku: '',
        barcode: '',
        costPrice: '',
        sellingPrice: '',
        stockQuantity: '0',
        minStockAlert: '3',
      },
    ],
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/sizes').then((r) => r.json()),
      fetch('/api/colors').then((r) => r.json()),
    ]).then(([c, s, co]) => {
      setCategories(c.categories ?? []);
      setSizes(s.sizes ?? []);
      setColors(co.colors ?? []);
    });
  }, []);

  function updateField<K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateVariant(tempId: string, key: keyof VariantForm, value: string) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => (v.tempId === tempId ? { ...v, [key]: value } : v)),
    }));
  }

  function addVariant() {
    setForm((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          tempId: cryptoId(),
          sizeId: '',
          colorId: '',
          sku: '',
          barcode: '',
          costPrice: '',
          sellingPrice: prev.suggestedPrice,
          stockQuantity: '0',
          minStockAlert: '3',
        },
      ],
    }));
  }

  function removeVariant(tempId: string) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.filter((v) => v.tempId !== tempId),
    }));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Imagem muito grande (máx 5MB)');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro no upload');
      updateField('imageUrl', data.url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar imagem';
      setError(message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validações
      if (!form.name.trim()) throw new Error('Nome é obrigatório');
      if (!form.categoryId) throw new Error('Selecione uma categoria');
      const suggestedPriceNum = parseFloat(form.suggestedPrice);
      if (!suggestedPriceNum || suggestedPriceNum <= 0) {
        throw new Error('Preço sugerido inválido');
      }

      if (!isEdit && form.variants.length === 0) {
        throw new Error('Adicione pelo menos uma variante');
      }

      // Construir payload
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        brand: form.brand.trim() || undefined,
        gender: form.gender,
        categoryId: form.categoryId,
        suggestedPrice: suggestedPriceNum,
        imageUrl: form.imageUrl || undefined,
        sku: form.sku.trim() || undefined,
        barcode: form.barcode.trim() || undefined,
      };

      if (!isEdit) {
        // Validar variantes
        const parsedVariants = form.variants.map((v, idx) => {
          if (!v.sizeId) throw new Error(`Variante ${idx + 1}: selecione um tamanho`);
          if (!v.colorId) throw new Error(`Variante ${idx + 1}: selecione uma cor`);
          if (!v.sku.trim()) throw new Error(`Variante ${idx + 1}: SKU obrigatório`);

          const cost = parseFloat(v.costPrice);
          const selling = parseFloat(v.sellingPrice);
          if (isNaN(cost) || cost < 0) throw new Error(`Variante ${idx + 1}: custo inválido`);
          if (!selling || selling <= 0) throw new Error(`Variante ${idx + 1}: preço de venda inválido`);

          return {
            sizeId: v.sizeId,
            colorId: v.colorId,
            sku: v.sku.trim(),
            barcode: v.barcode.trim() || undefined,
            costPrice: cost,
            sellingPrice: selling,
            stockQuantity: parseInt(v.stockQuantity) || 0,
            minStockAlert: parseInt(v.minStockAlert) || 3,
          };
        });
        payload.variants = parsedVariants;
      }

      const url = isEdit ? `/api/products/${productId}` : '/api/products';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar');

      router.push('/admin/produtos');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar';
      setError(message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={S.form}>
      {/* DADOS BÁSICOS */}
      <section style={S.section}>
        <h3 style={S.sectionTitle}>Dados Básicos</h3>

        <div style={S.row2}>
          <Field label="Nome do produto *" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              style={S.input}
              placeholder="Ex: Vestido Floral"
              required
            />
          </Field>
          <Field label="Marca">
            <input
              type="text"
              value={form.brand}
              onChange={(e) => updateField('brand', e.target.value)}
              style={S.input}
              placeholder="Ex: Atelier"
            />
          </Field>
        </div>

        <div style={S.row2}>
          <Field label="Categoria *" required>
            <select
              value={form.categoryId}
              onChange={(e) => updateField('categoryId', e.target.value)}
              style={S.input}
              required
            >
              <option value="">Selecione...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parent ? `${c.parent.name} → ${c.name}` : c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Gênero *">
            <select
              value={form.gender}
              onChange={(e) => updateField('gender', e.target.value as ProductFormData['gender'])}
              style={S.input}
            >
              <option value="UNISEX">Unissex</option>
              <option value="FEMALE">Feminino</option>
              <option value="MALE">Masculino</option>
              <option value="KIDS">Infantil</option>
            </select>
          </Field>
        </div>

        <div style={S.row2}>
          <Field label="Preço sugerido *" required>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.suggestedPrice}
              onChange={(e) => updateField('suggestedPrice', e.target.value)}
              style={S.input}
              placeholder="0,00"
              required
            />
          </Field>
          <Field label="SKU base (opcional)">
            <input
              type="text"
              value={form.sku}
              onChange={(e) => updateField('sku', e.target.value)}
              style={S.input}
              placeholder="Ex: VEST-FLOR"
            />
          </Field>
        </div>

        <Field label="Descrição">
          <textarea
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            style={{ ...S.input, minHeight: 80, resize: 'vertical', fontFamily: "'DM Sans', sans-serif" }}
            placeholder="Descreva o produto..."
          />
        </Field>
      </section>

      {/* IMAGEM */}
      <section style={S.section}>
        <h3 style={S.sectionTitle}>Imagem do Produto</h3>
        <div style={S.imageBox}>
          {form.imageUrl ? (
            <div style={S.imagePreview}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.imageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                onClick={() => updateField('imageUrl', '')}
                style={S.imageRemove}
              >
                ✕
              </button>
            </div>
          ) : (
            <div style={S.imageEmpty}>
              <span style={{ fontSize: 32, color: 'var(--text-dim)' }}>◧</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                Nenhuma imagem
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={S.imageBtn}
          >
            {uploading ? 'Enviando...' : form.imageUrl ? 'Trocar imagem' : 'Selecionar imagem'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: "'DM Mono', monospace", marginLeft: 12 }}>
            JPG, PNG ou WEBP — máx 5MB
          </span>
        </div>
      </section>

      {/* VARIANTES (apenas no criar) */}
      {!isEdit && (
        <section style={S.section}>
          <div style={S.variantsHeader}>
            <h3 style={S.sectionTitle}>Variantes (Tamanho + Cor)</h3>
            <button type="button" onClick={addVariant} style={S.btnSecondary}>
              + Adicionar variante
            </button>
          </div>
          <p style={S.hint}>
            Cada combinação de tamanho e cor é uma variante única com seu próprio estoque e preço.
          </p>

          {form.variants.map((v, idx) => (
            <div key={v.tempId} style={S.variantCard}>
              <div style={S.variantHeader}>
                <span style={S.variantNumber}>Variante {idx + 1}</span>
                {form.variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVariant(v.tempId)}
                    style={S.btnRemove}
                  >
                    Remover
                  </button>
                )}
              </div>

              <div style={S.row3}>
                <Field label="Tamanho *" small>
                  <select
                    value={v.sizeId}
                    onChange={(e) => updateVariant(v.tempId, 'sizeId', e.target.value)}
                    style={S.input}
                    required
                  >
                    <option value="">—</option>
                    {sizes.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Cor *" small>
                  <select
                    value={v.colorId}
                    onChange={(e) => updateVariant(v.tempId, 'colorId', e.target.value)}
                    style={S.input}
                    required
                  >
                    <option value="">—</option>
                    {colors.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="SKU *" small>
                  <input
                    type="text"
                    value={v.sku}
                    onChange={(e) => updateVariant(v.tempId, 'sku', e.target.value)}
                    style={S.input}
                    placeholder="VEST-FLOR-M-FLOR"
                    required
                  />
                </Field>
              </div>

              <div style={S.row3}>
                <Field label="Custo *" small>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={v.costPrice}
                    onChange={(e) => updateVariant(v.tempId, 'costPrice', e.target.value)}
                    style={S.input}
                    placeholder="0,00"
                    required
                  />
                </Field>
                <Field label="Preço venda *" small>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={v.sellingPrice}
                    onChange={(e) => updateVariant(v.tempId, 'sellingPrice', e.target.value)}
                    style={S.input}
                    placeholder="0,00"
                    required
                  />
                </Field>
                <Field label="Estoque inicial" small>
                  <input
                    type="number"
                    min="0"
                    value={v.stockQuantity}
                    onChange={(e) => updateVariant(v.tempId, 'stockQuantity', e.target.value)}
                    style={S.input}
                    placeholder="0"
                  />
                </Field>
              </div>

              <div style={S.row2}>
                <Field label="Código de barras" small>
                  <input
                    type="text"
                    value={v.barcode}
                    onChange={(e) => updateVariant(v.tempId, 'barcode', e.target.value)}
                    style={S.input}
                    placeholder="789..."
                  />
                </Field>
                <Field label="Alerta de estoque baixo" small>
                  <input
                    type="number"
                    min="0"
                    value={v.minStockAlert}
                    onChange={(e) => updateVariant(v.tempId, 'minStockAlert', e.target.value)}
                    style={S.input}
                  />
                </Field>
              </div>
            </div>
          ))}
        </section>
      )}

      {isEdit && (
        <div style={S.editVariantsHint}>
          Para gerenciar as variantes deste produto,{' '}
          <a href={`/admin/produtos/${productId}/variants`} style={{ color: 'var(--accent)' }}>
            clique aqui
          </a>
          .
        </div>
      )}

      {error && <div style={S.error}>{error}</div>}

      <div style={S.actions}>
        <button type="button" onClick={() => router.back()} style={S.btnGhost} disabled={loading}>
          Cancelar
        </button>
        <button type="submit" style={S.btnPrimary} disabled={loading || uploading}>
          {loading ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar produto'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children, required, small }: { label: string; children: React.ReactNode; required?: boolean; small?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: small ? 12 : 16 }}>
      <label style={{
        fontSize: small ? 10 : 11,
        color: 'var(--text-dim)',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        fontFamily: "'DM Mono', monospace",
      }}>
        {label}{required && ''}
      </label>
      {children}
    </div>
  );
}

function cryptoId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

const S: Record<string, React.CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 880 },
  section: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 24,
  },
  sectionTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 16,
    color: 'var(--text)',
  },
  hint: { fontSize: 12, color: 'var(--text-dim)', marginBottom: 16, fontFamily: "'DM Mono', monospace" },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  row3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 4 },
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
  imageBox: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  imageEmpty: {
    width: 120,
    height: 120,
    background: 'var(--bg)',
    border: '1px dashed var(--border)',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreview: {
    width: 120,
    height: 120,
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative' as const,
  },
  imageRemove: {
    position: 'absolute' as const,
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    background: 'rgba(0,0,0,0.7)',
    border: 'none',
    borderRadius: '50%',
    color: 'white',
    cursor: 'pointer',
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageBtn: {
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    padding: '8px 16px',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  variantsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  variantCard: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  variantHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  variantNumber: {
    fontSize: 11,
    color: 'var(--accent)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontFamily: "'DM Mono', monospace",
    fontWeight: 500,
  },
  btnRemove: {
    background: 'transparent',
    color: '#C86E6E',
    border: 'none',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: "'DM Mono', monospace",
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  btnSecondary: {
    background: 'var(--accent-dim)',
    color: 'var(--accent)',
    border: '1px solid #C8A96E44',
    padding: '8px 14px',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 500,
  },
  editVariantsHint: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 16,
    fontSize: 13,
    color: 'var(--text-muted)',
  },
  error: {
    background: '#C86E6E22',
    border: '1px solid #C86E6E55',
    color: '#C86E6E',
    padding: '12px 16px',
    borderRadius: 8,
    fontSize: 13,
  },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  btnGhost: {
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    padding: '10px 20px',
    borderRadius: 8,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  btnPrimary: {
    background: 'var(--accent)',
    color: '#0F0F0F',
    padding: '10px 24px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
};
