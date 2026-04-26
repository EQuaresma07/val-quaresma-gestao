'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      style={{
        background: 'transparent',
        color: 'var(--text-muted)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '8px 16px',
        fontSize: 13,
        cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {loading ? 'Saindo...' : 'Sair'}
    </button>
  );
}
