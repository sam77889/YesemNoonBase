import { useGlobalFilters } from '../hooks/useGlobalFilters';
import { useScrapeController } from '../hooks/useScrapeController';
import { AnalysisView } from './AnalysisPage';

export function MobileCategoryAnalysisPage() {
  const gf = useGlobalFilters();
  const sc = useScrapeController();

  return (
    <div style={{ padding: '1rem', paddingBottom: '2rem' }}>
      <AnalysisView 
        mode="category" 
        categoryTabs={gf.categoryTabs} 
        onExecutionUpdate={sc.handleAnalysisExecutionUpdate} 
      />
    </div>
  );
}
