import { useScrapeController } from '../hooks/useScrapeController';
import { AnalysisView } from './AnalysisPage';

export function MobileSkuAnalysisPage() {
  const sc = useScrapeController();

  return (
    <div style={{ padding: '1rem', paddingBottom: '2rem' }}>
      <AnalysisView 
        mode="sku" 
        onExecutionUpdate={sc.handleAnalysisExecutionUpdate} 
      />
    </div>
  );
}
