'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞', href: '/admin' },
  { id: 'products', label: 'Produtos', icon: '◈', href: '/admin/produtos' },
  { id: 'stock', label: 'Estoque', icon: '⬡', href: '/admin/estoque' },
  { id: 'sales', label: 'Vendas', icon: '◎', href: '/admin/vendas' },
  { id: 'customers', label: 'Clientes', icon: '○', href: '/admin/clientes' },
  { id: 'suppliers', label: 'Fornecedores', icon: '◇', href: '/admin/fornecedores' },
  { id: 'cashflow', label: 'Financeiro', icon: '◰', href: '/admin/financeiro' },
];

export default function AdminSidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <aside style={S.sidebar}>
      <div style={S.brand}>
        <div style={S.brandName}>Atelier</div>
        <div style={S.brandSub}>GESTÃO · LOJA</div>
      </div>

      <nav style={S.nav}>
        {NAV.map((item) => {
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              style={{ ...S.navItem, ...(isActive ? S.navItemActive : {}) }}
            >
              <span style={S.navIcon}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
        <Link href="/pdv" style={{ ...S.navItem, ...S.pdvLink }}>
          <span style={S.navIcon}>◉</span>
          Abrir PDV
        </Link>
      </nav>

      <div style={S.footer}>
        <div style={S.userChip}>
          <div style={S.avatar}>{userName.slice(0, 2).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.userName}>{userName}</div>
            <button onClick={handleLogout} disabled={loggingOut} style={S.logoutBtn}>
              {loggingOut ? 'Saindo...' : 'Sair'}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

const S: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 220,
    minWidth: 220,
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    position: 'sticky',
    top: 0,
  },
  brand: {
    padding: '28px 24px 24px',
    borderBottom: '1px solid var(--border)',
  },
  brandName: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--accent)',
    letterSpacing: 0.5,
  },
  brandSub: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    color: 'var(--text-dim)',
    letterSpacing: 2,
    marginTop: 4,
  },
  nav: {
    padding: '16px 12px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13.5,
    color: 'var(--text-muted)',
    border: '1px solid transparent',
    textDecoration: 'none',
    fontFamily: "'DM Sans', sans-serif",
  },
  navItemActive: {
    background: 'var(--accent-dim)',
    color: 'var(--accent)',
    borderColor: '#C8A96E33',
    fontWeight: 500,
  },
  navIcon: {
    fontSize: 14,
    width: 16,
    textAlign: 'center' as const,
    opacity: 0.8,
  },
  pdvLink: {
    marginTop: 12,
    background: 'var(--accent-dim)',
    color: 'var(--accent)',
    border: '1px solid #C8A96E33',
  },
  footer: {
    padding: '16px 12px',
    borderTop: '1px solid var(--border)',
  },
  userChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 6,
    background: 'var(--bg)',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'var(--accent-dim)',
    border: '1px solid #C8A96E44',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    color: 'var(--accent)',
    fontWeight: 600,
    flexShrink: 0,
  },
  userName: {
    fontSize: 12.5,
    color: 'var(--text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  logoutBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-dim)',
    fontSize: 11,
    cursor: 'pointer',
    padding: 0,
    marginTop: 2,
    fontFamily: "'DM Mono', monospace",
    textAlign: 'left' as const,
  },
};
