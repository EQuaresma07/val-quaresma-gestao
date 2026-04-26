import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AdminSidebar from './_components/AdminSidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <AdminSidebar userName={user.name} />
      <main style={{ flex: 1, minWidth: 0, overflowX: 'hidden' }}>{children}</main>
    </div>
  );
}
