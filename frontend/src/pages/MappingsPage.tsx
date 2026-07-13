import { useState, useRef, useCallback } from 'react';
import { useDataFetch } from '../hooks/useDataFetch';
import { useToast } from '../hooks/useToast';
import { mappingService } from '../services/api/mappingService';
import type { KraMapping } from '../lib/types';
import { CopyableId } from '../components/ui/CopyableId';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorCard } from '../components/ui/ErrorCard';
import { ConfirmModal } from '../components/ui/ConfirmModal';

export function MappingsPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data Fetch
  const { data, isLoading, error, refetch } = useDataFetch(
    () => mappingService.fetchMappings(),
    []
  );

  // Modal State
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Drag & Drop State
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Inline Delete
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget;
    setDeleteTarget(null);

    // Optimistically update UI could be done here if we had local state for mappings,
    // but refetch is safer for this rare operation.
    const result = await mappingService.deleteMapping(targetId);
    if (result.ok) {
      toast({ type: 'success', message: 'Mapping deleted successfully' });
      refetch();
    } else {
      toast({ type: 'error', message: `Delete failed: ${result.error.message}` });
    }
  };

  // Upload Logic
  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast({ type: 'error', message: 'Please upload a valid CSV file.' });
      return;
    }

    setIsUploading(true);
    const result = await mappingService.uploadBulkCSV(file);
    setIsUploading(false);

    if (result.ok) {
      toast({ type: 'success', message: 'Mappings imported successfully' });
      refetch();
    } else {
      toast({ type: 'error', message: `Import failed: ${result.error.message}` });
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="p-6 md:p-8 animate-fade-in">
        <ErrorCard error={error} onRetry={refetch} />
      </div>
    );
  }

  const mappings = data?.data || [];
  const hasMappings = mappings.length > 0;

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden animate-fade-in">
      
      {/* Left: Active Mappings List */}
      <div className="flex-1 flex flex-col p-6 md:p-8 md:border-r border-slate-700/50 min-h-0 overflow-y-auto">
        <h2 className="text-xl font-semibold text-slate-50 mb-6 shrink-0">
          KRA Mappings Configuration
        </h2>

        {isLoading && !data ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 bg-surface rounded-lg border border-slate-700/50 flex items-center px-4 shimmer">
                <div className="h-4 w-1/4 bg-slate-700/50 rounded-full" />
              </div>
            ))}
          </div>
        ) : !hasMappings ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <line x1="10" y1="9" x2="8" y2="9" />
                </svg>
              }
              title="No KRA mappings configured"
              description="Upload a CSV file containing your internal system IDs and KRA PIN mappings using the dropzone."
              action={{
                label: 'Upload CSV',
                onClick: () => fileInputRef.current?.click()
              }}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {mappings.map((mapping: KraMapping) => (
              <div 
                key={mapping.id}
                className="bg-surface rounded-lg border border-slate-700/50 p-4 flex items-center justify-between group hover:border-slate-600 transition-colors"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-200">{mapping.kra_pin}</span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs font-mono text-slate-400">{mapping.mapping_code}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Mapping ID:</span>
                    <CopyableId id={mapping.id} />
                  </div>
                </div>
                
                <button
                  onClick={() => setDeleteTarget(mapping.id)}
                  className="p-2 text-slate-500 hover:text-coral-500 hover:bg-coral-500/10 rounded transition-colors focus:outline-none opacity-0 group-hover:opacity-100 focus:opacity-100"
                  aria-label="Delete mapping"
                  title="Delete mapping"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: Upload Dropzone Panel */}
      <div className="w-full md:w-[320px] lg:w-[400px] shrink-0 bg-surface/30 p-6 md:p-8 flex flex-col justify-center">
        <h3 className="text-sm font-semibold text-slate-50 mb-2">Import Mappings</h3>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          Upload a standard CSV file with <code className="text-emerald-400 bg-emerald-400/10 px-1 py-0.5 rounded">internal_system_id,kra_pin</code> columns to bulk insert or update mapping definitions.
        </p>

        <form onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()} className="relative">
          <input 
            ref={fileInputRef}
            type="file" 
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />
          
          <label
            htmlFor="file-upload"
            className={`
              flex flex-col items-center justify-center p-8 rounded-xl cursor-pointer text-center
              ${dragActive ? 'dropzone-active' : 'dropzone-idle bg-surface'}
              ${isUploading ? 'opacity-50 pointer-events-none' : 'hover:border-slate-500 hover:bg-surface-elevated'}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={(e) => {
              e.preventDefault();
              fileInputRef.current?.click();
            }}
          >
            <div className={`mb-4 p-3 rounded-full ${dragActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-400'}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <span className="text-sm font-medium text-slate-300 mb-1">
              {isUploading ? 'Uploading...' : dragActive ? 'Drop CSV here' : 'Click to select CSV'}
            </span>
            <span className="text-xs text-slate-500">
              or drag and drop
            </span>
          </label>
        </form>
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete KRA Mapping"
        message="Are you sure you want to delete this mapping? This action cannot be undone and transactions using this internal ID will fail eTIMS resolution."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
