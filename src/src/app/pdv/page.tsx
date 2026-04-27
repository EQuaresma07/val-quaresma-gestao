'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// ============================================================
// Tipos
// ============================================================
interface Variant {
  id: string;
  sku: string;
  barcode: string | null;
  sellingPrice: number;
  stockQuantity: number;
  product: { id: string; name: string; brand: string | null; imageUrl: string | null };
  size: { id: string; name: string };
  color: { id: string; name: string; hexCode: string | null };
}

interface CartItem {
  variantId: string;
  productName: string;
  sizeName: string;
  colorName: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  discount: number; // valor R$ no item
  stockAvailable: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  cpf: string | null;
  creditLimit: number;
  currentDebt: number;
}

type PaymentMethod = 'PIX' | 'DEBIT' | 'CREDIT' | 'CASH' | 'CREDIT_NOTE';

interface Payment {
  method: PaymentMethod;
  amount: number;
  installments: number;
}

interface CompletedSale {
  saleNumber: number;
  total: number;
  payments: { method: PaymentMethod; amount: number; installments: number }[];
  customer: Customer | null;
  saleDate: string;
  id: string;
}

// ============================================================
// Componente
// ============================================================
export default function PDVPage() {
  const router = useRouter();

  // Carrinho e cliente
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [cartDiscount, setCartDiscount] = useState(0);

  // Busca de produtos
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState<'name' | 'barcode'>('barcode');
  const [searchResults, setSearchResults] = useState<Variant[]>([]);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modais
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showItemDiscountFor, setShowItemDiscountFor] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);

  // ===========================================================
  // CÁLCULOS
  // ===========================================================
  const subtotal = cart.reduce(
    (acc, it) => acc + it.unitPrice * it.quantity - it.discount,
    0,
  );
  const total = Math.max(0, subtotal - cartDiscount);
  const itemCount = cart.reduce((acc, it) => acc + it.quantity, 0);

  // ===========================================================
  // BUSCA
  // ===========================================================
  const performSearch = useCallback(async (term: string, isBarcode: boolean) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({ q: term });
      if (isBarcode) params.set('barcode', '1');
      const res = await fetch(`/api/products/search?${params}`);
      const data = await res.json();
      setSearchResults(data.variants ?? []);

      // Auto-add quando código de barras retorna 1 resultado exato
      if (isBarcode && data.variants?.length === 1) {
        addToCart(data.variants[0]);
        setSearch('');
        setSearchResults([]);
      }
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounce na busca por nome / busca imediata em barcode (após 13+ dígitos ou Enter)
  useEffect(() => {
    if (searchMode === 'barcode') return; // barcode busca só no Enter
    const t = setTimeout(() => performSearch(search, false), 250);
    return () => clearTimeout(t);
  }, [search, searchMode, performSearch]);

  // Atalhos de teclado
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'F2') {
        e.preventDefault();
        setSearchMode('barcode');
        searchInputRef.current?.focus();
      } else if (e.key === 'F3') {
        e.preventDefault();
        setSearchMode('name');
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) setShowPaymentModal(true);
      } else if (e.key === 'F8') {
        e.preventDefault();
        setShowCustomerModal(true);
      } else if (e.key === 'Escape') {
        if (completedSale) setCompletedSale(null);
        else if (showPaymentModal) setShowPaymentModal(false);
        else if (showCustomerModal) setShowCustomerModal(false);
        else if (showItemDiscountFor) setShowItemDiscountFor(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cart.length, completedSale, showPaymentModal, showCustomerModal, showItemDiscountFor]);

  // Foco automático no campo de busca
  useEffect(() => {
    if (!showPaymentModal && !showCustomerModal && !completedSale) {
      searchInputRef.current?.focus();
    }
  }, [showPaymentModal, showCustomerModal, completedSale]);

  // ===========================================================
  // CARRINHO
  // ===========================================================
  function addToCart(variant: Variant) {
    if (variant.stockQuantity <= 0) {
      alert(`Produto sem estoque: ${variant.product.name}`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((it) => it.variantId === variant.id);
      if (existing) {
        if (existing.quantity >= variant.stockQuantity) {
          alert(`Estoque máximo atingido (${variant.stockQuantity} un.)`);
          return prev;
        }
        return prev.map((it) =>
          it.variantId === variant.id ? { ...it, quantity: it.quantity + 1 } : it,
        );
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          productName: variant.product.name,
          sizeName: variant.size.name,
          colorName: variant.color.name,
          imageUrl: variant.product.imageUrl,
          quantity: 1,
          unitPrice: variant.sellingPrice,
          discount: 0,
          stockAvailable: variant.stockQuantity,
        },
      ];
    });
  }

  function changeQuantity(variantId: string, delta: number) {
    setCart((prev) =>
      prev.map((it) => {
        if (it.variantId !== variantId) return it;
        const newQty = it.quantity + delta;
        if (newQty <= 0) return it;
        if (newQty > it.stockAvailable) {
          alert(`Estoque máximo: ${it.stockAvailable} un.`);
          return it;
        }
        return { ...it, quantity: newQty };
      }),
    );
  }

  function removeItem(variantId: string) {
    setCart((prev) => prev.filter((it) => it.variantId !== variantId));
  }

  function clearCart() {
    if (cart.length === 0) return;
    if (confirm('Limpar carrinho?')) {
      setCart([]);
      setCartDiscount(0);
    }
  }

  function applyItemDiscount(variantId: string, discount: number) {
    setCart((prev) =>
      prev.map((it) => {
        if (it.variantId !== variantId) return it;
        const max = it.unitPrice * it.quantity;
        return { ...it, discount: Math.max(0, Math.min(discount, max)) };
      }),
    );
    setShowItemDiscountFor(null);
  }

  // ===========================================================
  // FINALIZAR VENDA
  // ===========================================================
  async function finalizeSale(payments: Payment[]) {
    try {
      const payload = {
        customerId: customer?.id ?? null,
        items: cart.map((it) => ({
          variantId: it.variantId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: it.discount,
        })),
        payments: payments.map((p) => ({
          method: p.method,
          amount: p.amount,
          installments: p.installments,
        })),
        discount: cartDiscount,
      };

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? 'Erro ao finalizar venda');
        return;
      }

      setShowPaymentModal(false);
      setCompletedSale({
        saleNumber: data.sale.saleNumber,
        total: data.sale.total,
        payments: data.sale.payments,
        customer,
        saleDate: data.sale.saleDate,
        id: data.sale.id,
      });

      // Resetar
      setCart([]);
      setCartDiscount(0);
      setCustomer(null);
    } catch {
      alert('Erro ao processar venda');
    }
  }

  // ===========================================================
  // RENDER
  // ===========================================================
  return (
    <div style={S.root}>
      {/* HEADER */}
      <header style={S.header}>
        <div style={S.brand}>
          <Link href="/admin" style={S.backLink}>← Admin</Link>
          <span style={S.brandName}>PDV</span>
        </div>
        <div style={S.headerInfo}>
          <span style={S.kbHint}>F2 código · F3 nome · F4 finalizar · F8 cliente</span>
        </div>
      </header>

      <div style={S.body}>
        {/* COLUNA ESQUERDA: BUSCA + RESULTADOS */}
        <div style={S.leftCol}>
          <div style={S.searchModeTabs}>
            <button
              onClick={() => { setSearchMode('barcode'); searchInputRef.current?.focus(); }}
              style={{
                ...S.tabBtn,
                ...(searchMode === 'barcode' ? S.tabBtnActive : {}),
              }}
            >
              Código de barras (F2)
            </button>
            <button
              onClick={() => { setSearchMode('name'); searchInputRef.current?.focus(); }}
              style={{
                ...S.tabBtn,
                ...(searchMode === 'name' ? S.tabBtnActive : {}),
              }}
            >
              Buscar por nome (F3)
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              performSearch(search, searchMode === 'barcode');
            }}
            style={S.searchForm}
          >
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => {
                const val = e.target.value;
                setSearch(val);
                // auto-busca se barcode com 13+ dígitos
                if (searchMode === 'barcode' && /^\d{13,}$/.test(val.trim())) {
                  performSearch(val, true);
                }
              }}
              placeholder={
                searchMode === 'barcode'
                  ? 'Escaneie ou digite o código...'
                  : 'Digite nome do produto, marca ou SKU...'
              }
              style={S.searchInput}
              autoFocus
            />
          </form>

          {/* Resultados */}
          <div style={S.resultsArea}>
            {searching && <div style={S.muted}>Buscando...</div>}
            {!searching && search && searchResults.length === 0 && (
              <div style={S.muted}>Nenhum produto encontrado</div>
            )}
            {!searching && searchResults.length > 0 && (
              <div style={S.resultsList}>
                {searchResults.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => addToCart(v)}
                    style={S.resultItem}
                    disabled={v.stockQuantity <= 0}
                  >
                    <div style={S.resultImg}>
                      {v.product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.product.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: 20, color: 'var(--text-dim)' }}>◈</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.resultName}>{v.product.name}</div>
                      <div style={S.resultMeta}>
                        {v.size.name} · {v.color.name} · {v.sku}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={S.resultPrice}>{formatBRL(v.sellingPrice)}</div>
                      <div style={{
                        ...S.resultStock,
                        color: v.stockQuantity <= 0 ? '#C86E6E' : v.stockQuantity < 5 ? '#D4A553' : 'var(--text-dim)',
                      }}>
                        {v.stockQuantity <= 0 ? 'Sem estoque' : `${v.stockQuantity} un.`}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {!search && (
              <div style={S.placeholder}>
                <div style={{ fontSize: 36, color: 'var(--text-dim)', marginBottom: 12 }}>⌕</div>
                <div style={S.muted}>Escaneie um produto ou digite para buscar</div>
              </div>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: CARRINHO */}
        <div style={S.rightCol}>
          {/* Cliente */}
          <div style={S.customerSection}>
            <div style={S.customerLabel}>Cliente</div>
            {customer ? (
              <div style={S.customerCard}>
                <div>
                  <div style={S.customerName}>{customer.name}</div>
                  <div style={S.customerMeta}>
                    {customer.phone && `${customer.phone} · `}
                    Dívida: {formatBRL(customer.currentDebt)}
                  </div>
                </div>
                <button onClick={() => setCustomer(null)} style={S.btnSmallGhost}>×</button>
              </div>
            ) : (
              <button onClick={() => setShowCustomerModal(true)} style={S.btnSelectCustomer}>
                + Selecionar cliente (F8)
              </button>
            )}
          </div>

          {/* Itens do carrinho */}
          <div style={S.cartArea}>
            <div style={S.cartHeader}>
              <span>Itens ({itemCount})</span>
              {cart.length > 0 && (
                <button onClick={clearCart} style={S.btnSmallGhost}>Limpar</button>
              )}
            </div>

            {cart.length === 0 ? (
              <div style={S.emptyCart}>
                <div style={{ fontSize: 28, color: 'var(--text-dim)' }}>◎</div>
                <div style={S.muted}>Carrinho vazio</div>
              </div>
            ) : (
              <div style={S.cartList}>
                {cart.map((it) => {
                  const lineTotal = it.unitPrice * it.quantity - it.discount;
                  return (
                    <div key={it.variantId} style={S.cartItem}>
                      <div style={S.cartItemImg}>
                        {it.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>◈</span>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={S.cartItemName}>{it.productName}</div>
                        <div style={S.cartItemMeta}>{it.sizeName} · {it.colorName}</div>
                        <div style={S.cartItemPrice}>
                          {formatBRL(it.unitPrice)} {it.discount > 0 && (
                            <span style={{ color: '#D4A553', fontSize: 10 }}> - {formatBRL(it.discount)}</span>
                          )}
                        </div>
                      </div>
                      <div style={S.cartItemActions}>
                        <div style={S.qtyControl}>
                          <button onClick={() => changeQuantity(it.variantId, -1)} style={S.qtyBtn}>−</button>
                          <span style={S.qtyValue}>{it.quantity}</span>
                          <button onClick={() => changeQuantity(it.variantId, 1)} style={S.qtyBtn}>+</button>
                        </div>
                        <div style={S.cartItemTotal}>{formatBRL(lineTotal)}</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => setShowItemDiscountFor(it.variantId)}
                            style={S.btnTiny}
                            title="Desconto neste item"
                          >
                            %
                          </button>
                          <button
                            onClick={() => removeItem(it.variantId)}
                            style={{ ...S.btnTiny, color: '#C86E6E' }}
                            title="Remover"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Totais e finalizar */}
          <div style={S.summary}>
            <div style={S.summaryLine}>
              <span>Subtotal</span>
              <span>{formatBRL(subtotal)}</span>
            </div>
            {cartDiscount > 0 && (
              <div style={{ ...S.summaryLine, color: '#D4A553' }}>
                <span>Desconto carrinho</span>
                <span>− {formatBRL(cartDiscount)}</span>
              </div>
            )}
            <div style={S.summaryTotal}>
              <span>Total</span>
              <span>{formatBRL(total)}</span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Desconto carrinho"
                value={cartDiscount || ''}
                onChange={(e) => setCartDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                style={S.discountInput}
              />
              <button
                onClick={() => setShowPaymentModal(true)}
                disabled={cart.length === 0}
                style={S.btnFinalize}
              >
                Finalizar (F4)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE CLIENTE */}
      {showCustomerModal && (
        <CustomerModal
          onClose={() => setShowCustomerModal(false)}
          onSelect={(c) => {
            setCustomer(c);
            setShowCustomerModal(false);
          }}
        />
      )}

      {/* MODAL DE DESCONTO POR ITEM */}
      {showItemDiscountFor && (() => {
        const it = cart.find((i) => i.variantId === showItemDiscountFor);
        if (!it) return null;
        return (
          <ItemDiscountModal
            item={it}
            onClose={() => setShowItemDiscountFor(null)}
            onApply={(disc) => applyItemDiscount(showItemDiscountFor, disc)}
          />
        );
      })()}

      {/* MODAL DE PAGAMENTO */}
      {showPaymentModal && (
        <PaymentModal
          total={total}
          customer={customer}
          onClose={() => setShowPaymentModal(false)}
          onConfirm={finalizeSale}
        />
      )}

      {/* MODAL DE SUCESSO */}
      {completedSale && (
        <SuccessModal
          sale={completedSale}
          onClose={() => setCompletedSale(null)}
          onViewSales={() => router.push('/admin/vendas')}
        />
      )}
    </div>
  );
}

// ============================================================
// MODAL: BUSCAR CLIENTE
// ============================================================
function CustomerModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (c: Customer) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.customers ?? []);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <Modal onClose={onClose} title="Selecionar cliente">
      <input
        type="text"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Nome, telefone ou CPF..."
        style={S.modalInput}
      />
      <div style={{ marginTop: 12, maxHeight: 320, overflowY: 'auto' }}>
        {loading && <div style={S.muted}>Buscando...</div>}
        {!loading && q && results.length === 0 && (
          <div style={S.muted}>Nenhum cliente encontrado</div>
        )}
        {!loading && results.map((c) => (
          <button key={c.id} onClick={() => onSelect(c)} style={S.customerResult}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>{c.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: "'DM Mono', monospace" }}>
                {c.phone ?? c.cpf ?? '—'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Dívida</div>
              <div style={{
                fontSize: 12,
                color: c.currentDebt > 0 ? '#C86E6E' : 'var(--text-muted)',
                fontFamily: "'Playfair Display', serif",
              }}>
                {formatBRL(c.currentDebt)}
              </div>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

// ============================================================
// MODAL: DESCONTO POR ITEM
// ============================================================
function ItemDiscountModal({
  item,
  onClose,
  onApply,
}: {
  item: CartItem;
  onClose: () => void;
  onApply: (disc: number) => void;
}) {
  const [type, setType] = useState<'fixed' | 'percent'>('fixed');
  const [value, setValue] = useState('');
  const max = item.unitPrice * item.quantity;

  function handleApply() {
    const v = parseFloat(value) || 0;
    if (type === 'percent') {
      onApply(Math.min(max * (v / 100), max));
    } else {
      onApply(Math.min(v, max));
    }
  }

  return (
    <Modal onClose={onClose} title={`Desconto no item: ${item.productName}`}>
      <div style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: 12 }}>
        Subtotal do item: <strong>{formatBRL(max)}</strong>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setType('fixed')}
          style={{ ...S.tabBtn, flex: 1, ...(type === 'fixed' ? S.tabBtnActive : {}) }}
        >
          R$ Fixo
        </button>
        <button
          onClick={() => setType('percent')}
          style={{ ...S.tabBtn, flex: 1, ...(type === 'percent' ? S.tabBtnActive : {}) }}
        >
          %
        </button>
      </div>
      <input
        type="number"
        step="0.01"
        min="0"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleApply()}
        placeholder={type === 'fixed' ? '0,00' : '0'}
        style={S.modalInput}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={S.btnGhost}>Cancelar</button>
        <button onClick={handleApply} style={S.btnPrimary}>Aplicar</button>
      </div>
    </Modal>
  );
}

// ============================================================
// MODAL: PAGAMENTO
// ============================================================
function PaymentModal({
  total,
  customer,
  onClose,
  onConfirm,
}: {
  total: number;
  customer: Customer | null;
  onClose: () => void;
  onConfirm: (payments: Payment[]) => void;
}) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [method, setMethod] = useState<PaymentMethod>('PIX');
  const [amountStr, setAmountStr] = useState(total.toFixed(2));
  const [installments, setInstallments] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const totalPaid = payments.reduce((a, p) => a + p.amount, 0);
  const remaining = +(total - totalPaid).toFixed(2);
  const cashOnly = payments.filter((p) => p.method === 'CASH').reduce((a, p) => a + p.amount, 0);
  const change = Math.max(0, totalPaid - total);

  function addPayment() {
    const amount = parseFloat(amountStr) || 0;
    if (amount <= 0) return;

    if (method === 'CREDIT_NOTE' && !customer) {
      alert('Venda fiada exige selecionar cliente antes');
      return;
    }
    if (method === 'CREDIT_NOTE' && customer) {
      const newDebt = customer.currentDebt + amount;
      if (newDebt > customer.creditLimit) {
        alert(`Limite de crédito excedido. Limite: ${formatBRL(customer.creditLimit)}, dívida: ${formatBRL(customer.currentDebt)}`);
        return;
      }
    }

    setPayments([...payments, { method, amount, installments }]);

    // Atualizar valor sugerido pra restante
    const newRemaining = +(total - (totalPaid + amount)).toFixed(2);
    setAmountStr(newRemaining > 0 ? newRemaining.toFixed(2) : '0.00');
    setInstallments(1);
  }

  function removePayment(idx: number) {
    setPayments(payments.filter((_, i) => i !== idx));
  }

  async function handleConfirm() {
    if (Math.abs(remaining) > 0.01 && remaining > 0) {
      alert(`Falta ${formatBRL(remaining)}`);
      return;
    }
    if (payments.length === 0) {
      alert('Adicione ao menos uma forma de pagamento');
      return;
    }
    setSubmitting(true);

    // Se sobrou troco em dinheiro, ajusta o pagamento em dinheiro pra ficar exato
    let adjustedPayments = [...payments];
    if (change > 0 && cashOnly >= change) {
      // Ajusta o último CASH pra remover o troco
      const lastCashIdx = adjustedPayments.map((p) => p.method).lastIndexOf('CASH');
      if (lastCashIdx >= 0) {
        adjustedPayments = adjustedPayments.map((p, i) =>
          i === lastCashIdx ? { ...p, amount: +(p.amount - change).toFixed(2) } : p,
        );
      }
    }

    await onConfirm(adjustedPayments);
    setSubmitting(false);
  }

  const showInstallments = method === 'CREDIT' || method === 'CREDIT_NOTE';
  const maxInstallments = method === 'CREDIT' ? 12 : 12;

  return (
    <Modal onClose={onClose} title="Pagamento" wide>
      <div style={S.payTotalRow}>
        <span>Total a pagar</span>
        <span style={S.payTotalValue}>{formatBRL(total)}</span>
      </div>

      {/* Métodos de pagamento */}
      <div style={S.methodGrid}>
        {(['PIX', 'DEBIT', 'CREDIT', 'CASH', 'CREDIT_NOTE'] as PaymentMethod[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMethod(m);
              if (m !== 'CREDIT' && m !== 'CREDIT_NOTE') setInstallments(1);
            }}
            disabled={m === 'CREDIT_NOTE' && !customer}
            style={{
              ...S.methodBtn,
              ...(method === m ? S.methodBtnActive : {}),
              ...(m === 'CREDIT_NOTE' && !customer ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
            }}
          >
            {methodLabel(m)}
            {m === 'CREDIT_NOTE' && !customer && (
              <span style={{ fontSize: 9, display: 'block', marginTop: 2 }}>Requer cliente</span>
            )}
          </button>
        ))}
      </div>

      {/* Valor + parcelas */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Valor</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            style={S.modalInput}
          />
        </div>
        {showInstallments && (
          <div style={{ width: 130 }}>
            <label style={S.label}>Parcelas</label>
            <select
              value={installments}
              onChange={(e) => setInstallments(parseInt(e.target.value))}
              style={S.modalInput}
            >
              {Array.from({ length: maxInstallments }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}x de {formatBRL((parseFloat(amountStr) || 0) / n)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button onClick={addPayment} style={S.btnPrimary}>Adicionar</button>
        </div>
      </div>

      {/* Lista de pagamentos */}
      {payments.length > 0 && (
        <div style={S.paymentsList}>
          {payments.map((p, idx) => (
            <div key={idx} style={S.paymentRow}>
              <span style={S.paymentMethod}>{methodLabel(p.method)}</span>
              {p.installments > 1 && (
                <span style={S.paymentInstallments}>
                  {p.installments}x de {formatBRL(p.amount / p.installments)}
                </span>
              )}
              <span style={S.paymentAmount}>{formatBRL(p.amount)}</span>
              <button onClick={() => removePayment(idx)} style={S.btnTiny}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Resumo */}
      <div style={S.payResume}>
        <div style={S.payResumeLine}>
          <span>Pago</span>
          <span>{formatBRL(totalPaid)}</span>
        </div>
        {remaining > 0 && (
          <div style={{ ...S.payResumeLine, color: '#C86E6E' }}>
            <span>Falta</span>
            <span>{formatBRL(remaining)}</span>
          </div>
        )}
        {change > 0 && (
          <div style={{ ...S.payResumeLine, color: '#D4A553' }}>
            <span>Troco</span>
            <span>{formatBRL(change)}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onClose} style={S.btnGhost} disabled={submitting}>
          Cancelar
        </button>
        <button
          onClick={handleConfirm}
          style={S.btnPrimary}
          disabled={submitting || remaining > 0.01 || payments.length === 0}
        >
          {submitting ? 'Processando...' : 'Confirmar venda'}
        </button>
      </div>
    </Modal>
  );
}

// ============================================================
// MODAL: SUCESSO
// ============================================================
function SuccessModal({
  sale,
  onClose,
  onViewSales,
}: {
  sale: CompletedSale;
  onClose: () => void;
  onViewSales: () => void;
}) {
  return (
    <Modal onClose={onClose} title="" hideClose>
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: '#5A8A5022', border: '2px solid #5A8A50',
          margin: '0 auto 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, color: '#5A8A50',
        }}>✓</div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, marginBottom: 6 }}>
          Venda concluída
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
          Venda #{String(sale.saleNumber).padStart(6, '0')}
        </p>

        <div style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 20,
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Total</div>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 32,
            color: 'var(--accent)',
            fontWeight: 600,
          }}>{formatBRL(sale.total)}</div>

          {sale.customer && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              Cliente: {sale.customer.name}
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-dim)' }}>
            {sale.payments.map((p, i) => (
              <div key={i} style={{ marginTop: 2 }}>
                {methodLabel(p.method)} {p.installments > 1 && `(${p.installments}x)`} · {formatBRL(p.amount)}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={onViewSales} style={S.btnGhost}>Ver vendas</button>
          <button onClick={onClose} style={S.btnPrimary}>Nova venda</button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// MODAL BASE
// ============================================================
function Modal({
  children,
  onClose,
  title,
  wide,
  hideClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  wide?: boolean;
  hideClose?: boolean;
}) {
  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div
        style={{
          ...S.modalBox,
          maxWidth: wide ? 560 : 460,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div style={S.modalHeader}>
            <h3 style={S.modalTitle}>{title}</h3>
            {!hideClose && (
              <button onClick={onClose} style={S.modalClose}>×</button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================
function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function methodLabel(m: string): string {
  const map: Record<string, string> = {
    PIX: 'Pix',
    DEBIT: 'Débito',
    CREDIT: 'Crédito',
    CASH: 'Dinheiro',
    CREDIT_NOTE: 'Fiado',
  };
  return map[m] ?? m;
}

// ============================================================
// ESTILOS
// ============================================================
const S: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: 'var(--bg)',
    color: 'var(--text)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    height: 56,
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 16 },
  backLink: {
    color: 'var(--text-muted)',
    fontSize: 12,
    textDecoration: 'none',
    fontFamily: "'DM Mono', monospace",
  },
  brandName: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 18,
    color: 'var(--accent)',
    fontWeight: 600,
  },
  headerInfo: {},
  kbHint: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    color: 'var(--text-dim)',
    letterSpacing: 0.5,
  },

  body: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr 480px',
    gap: 0,
    overflow: 'hidden',
  },
  leftCol: {
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  rightCol: {
    background: 'var(--surface)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },

  searchModeTabs: {
    display: 'flex',
    gap: 6,
    marginBottom: 12,
  },
  tabBtn: {
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  tabBtnActive: {
    background: 'var(--accent-dim)',
    color: 'var(--accent)',
    borderColor: '#C8A96E55',
  },

  searchForm: { marginBottom: 16 },
  searchInput: {
    width: '100%',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '14px 16px',
    color: 'var(--text)',
    fontSize: 15,
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
  },
  resultsArea: { flex: 1, overflowY: 'auto', minHeight: 0 },
  resultsList: { display: 'flex', flexDirection: 'column', gap: 6 },
  resultItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 14px',
    cursor: 'pointer',
    color: 'var(--text)',
    width: '100%',
    textAlign: 'left' as const,
    transition: 'border-color 0.15s',
  },
  resultImg: {
    width: 40,
    height: 40,
    background: 'var(--bg)',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  resultName: { fontSize: 13, fontWeight: 500, marginBottom: 2 },
  resultMeta: {
    fontSize: 10,
    color: 'var(--text-dim)',
    fontFamily: "'DM Mono', monospace",
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultPrice: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 14,
    color: 'var(--accent)',
    fontWeight: 600,
  },
  resultStock: {
    fontSize: 10,
    fontFamily: "'DM Mono', monospace",
    marginTop: 2,
  },
  placeholder: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  muted: { color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 16 },

  customerSection: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
  },
  customerLabel: {
    fontSize: 10,
    color: 'var(--text-dim)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontFamily: "'DM Mono', monospace",
    marginBottom: 8,
  },
  customerCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--bg)',
    border: '1px solid #C8A96E33',
    borderRadius: 8,
    padding: '10px 14px',
  },
  customerName: { fontSize: 13, color: 'var(--text)', marginBottom: 2 },
  customerMeta: { fontSize: 10, color: 'var(--text-dim)', fontFamily: "'DM Mono', monospace" },
  btnSelectCustomer: {
    width: '100%',
    background: 'transparent',
    border: '1px dashed var(--border)',
    color: 'var(--text-muted)',
    padding: '12px',
    borderRadius: 8,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  btnSmallGhost: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-dim)',
    fontSize: 14,
    cursor: 'pointer',
    padding: '4px 8px',
  },

  cartArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  cartHeader: {
    padding: '14px 20px 8px',
    fontSize: 11,
    color: 'var(--text-dim)',
    fontFamily: "'DM Mono', monospace",
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartList: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 20px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  cartItem: {
    display: 'flex',
    gap: 10,
    padding: '10px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
  },
  cartItemImg: {
    width: 44,
    height: 44,
    background: 'var(--surface)',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  cartItemName: { fontSize: 12, color: 'var(--text)', fontWeight: 500 },
  cartItemMeta: {
    fontSize: 10,
    color: 'var(--text-dim)',
    fontFamily: "'DM Mono', monospace",
    margin: '2px 0',
  },
  cartItemPrice: { fontSize: 11, color: 'var(--text-muted)' },
  cartItemActions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  qtyControl: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '2px 4px',
  },
  qtyBtn: {
    width: 22,
    height: 22,
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 14,
    cursor: 'pointer',
  },
  qtyValue: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 12,
    color: 'var(--text)',
    minWidth: 18,
    textAlign: 'center' as const,
  },
  cartItemTotal: {
    fontSize: 12,
    color: 'var(--accent)',
    fontFamily: "'Playfair Display', serif",
    fontWeight: 600,
  },
  btnTiny: {
    width: 22,
    height: 22,
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-dim)',
    fontSize: 11,
    cursor: 'pointer',
    padding: 0,
  },
  emptyCart: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  summary: {
    padding: '16px 20px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  summaryLine: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    color: 'var(--text-muted)',
    marginBottom: 4,
  },
  summaryTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 18,
    fontFamily: "'Playfair Display', serif",
    color: 'var(--accent)',
    fontWeight: 600,
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1px solid var(--border)',
  },
  discountInput: {
    flex: 1,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 12px',
    color: 'var(--text)',
    fontSize: 12,
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
  },
  btnFinalize: {
    flex: 2,
    background: 'var(--accent)',
    color: '#0F0F0F',
    border: 'none',
    padding: '12px 20px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },

  // MODALS
  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 20,
  },
  modalBox: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 16,
    color: 'var(--text)',
  },
  modalClose: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-dim)',
    fontSize: 22,
    cursor: 'pointer',
    padding: 0,
    width: 24,
    height: 24,
  },
  modalInput: {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '10px 12px',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
  },
  customerResult: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 14px',
    cursor: 'pointer',
    marginBottom: 6,
    color: 'var(--text)',
    textAlign: 'left' as const,
  },
  label: {
    display: 'block',
    fontSize: 10,
    color: 'var(--text-dim)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
    fontFamily: "'DM Mono', monospace",
  },

  payTotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: '12px 16px',
    background: 'var(--bg)',
    borderRadius: 8,
    marginBottom: 16,
  },
  payTotalValue: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 24,
    color: 'var(--accent)',
    fontWeight: 600,
  },
  methodGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 6,
    marginBottom: 16,
  },
  methodBtn: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 8px',
    color: 'var(--text-muted)',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    textAlign: 'center' as const,
  },
  methodBtnActive: {
    background: 'var(--accent-dim)',
    color: 'var(--accent)',
    borderColor: '#C8A96E66',
  },
  paymentsList: {
    background: 'var(--bg)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  paymentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 4px',
    fontSize: 12,
  },
  paymentMethod: {
    fontWeight: 500,
    color: 'var(--text)',
    minWidth: 70,
  },
  paymentInstallments: {
    fontSize: 10,
    color: 'var(--text-dim)',
    fontFamily: "'DM Mono', monospace",
    flex: 1,
  },
  paymentAmount: {
    fontFamily: "'Playfair Display', serif",
    color: 'var(--accent)',
    fontWeight: 600,
  },
  payResume: {
    background: 'var(--bg)',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  payResumeLine: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    padding: '4px 0',
  },

  btnPrimary: {
    background: 'var(--accent)',
    color: '#0F0F0F',
    border: 'none',
    padding: '10px 20px',
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
    padding: '10px 20px',
    borderRadius: 8,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
};
