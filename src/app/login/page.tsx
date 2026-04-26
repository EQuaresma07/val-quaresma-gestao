'use client';

import { Suspense, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') ?? '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Erro ao fazer login');
        setLoading(false);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError('Falha de conexão. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <h1 style={styles.brandName}>Atelier</h1>
          <span style={styles.brandTag}>SISTEMA · GESTÃO</span>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="seu@email.com"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Senha</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="••••••••"
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p style={styles.hint}>
          Acesso restrito. Use as credenciais do administrador.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--text)' }}>Carregando...</div>}>
      <LoginContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '40px 36px',
  },
  brand: {
    textAlign: 'center',
    marginBottom: 32,
  },
  brandName: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 28,
    color: 'var(--accent)',
    fontWeight: 700,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  brandTag: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    color: 'var(--text-dim)',
    letterSpacing: 3,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 11,
    color: 'var(--text-dim)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontFamily: "'DM Mono', monospace",
  },
  input: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '12px 14px',
    color: 'var(--text)',
    fontSize: 14,
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
  },
  error: {
    background: '#C86E6E22',
    border: '1px solid #C86E6E55',
    color: 'var(--red)',
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 13,
  },
  button: {
    background: 'var(--accent)',
    color: '#0F0F0F',
    border: 'none',
    borderRadius: 8,
    padding: '14px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    letterSpacing: 0.3,
    marginTop: 8,
  },
  hint: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 11,
    color: 'var(--text-dim)',
    fontFamily: "'DM Mono', monospace",
  },
};