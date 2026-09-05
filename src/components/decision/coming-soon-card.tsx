import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ComingSoonWorkstream } from '@/lib/contracts/types';

export function ComingSoonCard({ item }: { item: ComingSoonWorkstream }) {
  return (
    <Card className="opacity-60">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{item.label}</CardTitle>
          <Badge variant="outline">Not in this release</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{item.description}</p>
      </CardContent>
    </Card>
  );
}
