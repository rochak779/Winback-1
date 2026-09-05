import { DealGate } from '@/components/app-shell/deal-gate';

export default async function DealLayout({ children, params }: LayoutProps<'/deal/[id]'>) {
  const { id } = await params;
  return <DealGate id={id}>{children}</DealGate>;
}
