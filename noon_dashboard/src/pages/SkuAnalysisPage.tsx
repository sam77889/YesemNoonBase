import type { ExecutionUpdate } from '../types';
import { AnalysisView } from './AnalysisPage';

interface SkuAnalysisPageProps {
  initialSku?: string;
  autoRun?: boolean;
  onAutoRunConsumed?: () => void;
  onExecutionUpdate?: (update: ExecutionUpdate) => void;
}

export function SkuAnalysisPage({
  initialSku,
  autoRun,
  onAutoRunConsumed,
  onExecutionUpdate,
}: SkuAnalysisPageProps) {
  return (
    <AnalysisView
      mode="sku"
      initialSku={initialSku}
      autoRun={autoRun}
      onAutoRunConsumed={onAutoRunConsumed}
      onExecutionUpdate={onExecutionUpdate}
    />
  );
}
