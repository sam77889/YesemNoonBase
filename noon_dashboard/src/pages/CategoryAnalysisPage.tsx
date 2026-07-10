import type { ExecutionUpdate } from '../types';
import { AnalysisView } from './AnalysisPage';

interface CategoryAnalysisPageProps {
  categoryTabs?: [string, number][];
  onExecutionUpdate?: (update: ExecutionUpdate) => void;
}

export function CategoryAnalysisPage({
  categoryTabs,
  onExecutionUpdate,
}: CategoryAnalysisPageProps) {
  return <AnalysisView mode="category" categoryTabs={categoryTabs} onExecutionUpdate={onExecutionUpdate} />;
}
