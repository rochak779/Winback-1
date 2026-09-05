import { DealGate } from '@/components/app-shell/deal-gate';

export default async function DealLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DealGate id={id}>{children}</DealGate>;
}
