import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  FileUp, 
  Download, 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Layers, 
  Boxes, 
  FileCode, 
  ShieldAlert, 
  RefreshCw,
  X
} from 'lucide-react';
import styles from './ImportExportPage.module.css';

interface Location {
  id: string;
  name: string;
  code: string;
}

interface ImportDiagnostic {
  row: number;
  sku?: string;
  name?: string;
  location?: string;
  quantity?: number;
  error?: string;
}

interface ImportResult {
  message: string;
  totalRows: number;
  successCount: number;
  failureCount: number;
  errors?: ImportDiagnostic[];
}

export const ImportExportPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'items' | 'receipts'>('items');

  // Export State
  const [locations, setLocations] = useState<Location[]>([]);
  const [exportLocationId, setExportLocationId] = useState<string>('all');
  const [exporting, setExporting] = useState<boolean>(false);

  // Items Import State
  const [itemFile, setItemFile] = useState<File | null>(null);
  const [itemCsvText, setItemCsvText] = useState<string>('');
  const [useItemPaste, setUseItemPaste] = useState<boolean>(false);
  const [itemDragActive, setItemDragActive] = useState<boolean>(false);
  const [importingItems, setImportingItems] = useState<boolean>(false);
  const [itemResult, setItemResult] = useState<ImportResult | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);

  // Receipts Import State
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptCsvText, setReceiptCsvText] = useState<string>('');
  const [useReceiptPaste, setUseReceiptPaste] = useState<boolean>(false);
  const [receiptDragActive, setReceiptDragActive] = useState<boolean>(false);
  const [importingReceipts, setImportingReceipts] = useState<boolean>(false);
  const [receiptResult, setReceiptResult] = useState<ImportResult | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const itemFileInputRef = useRef<HTMLInputElement>(null);
  const receiptFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch locations for export dropdown
  useEffect(() => {
    fetch('/api/locations', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.locations) setLocations(data.locations);
      })
      .catch((err) => console.error('Failed to load locations', err));
  }, []);

  // Export Stock CSV
  const handleExportStock = async () => {
    try {
      setExporting(true);
      const url = exportLocationId !== 'all' 
        ? `/api/csv/export-stock?locationId=${encodeURIComponent(exportLocationId)}`
        : '/api/csv/export-stock';

      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Export failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.setAttribute('download', `stock_positions_${timestamp}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  // Helper to trigger direct client CSV download
  const downloadSample = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Sample templates
  const downloadItemSample = () => {
    const sample = `SKU,Name,Description,Category,UOM,Reorder Level\r\n` +
      `ELEC-CBL-001,Heavy Duty Copper Wire 50m,Standard grade electrical copper wiring,Electrical & Wiring,meters,25\r\n` +
      `PLUMB-VLV-002,Brass Ball Valve 1/2in,Threaded corrosion-resistant shutoff valve,Plumbing & Pipework,units,15\r\n` +
      `SAFE-GLV-003,Nitrile Work Gloves Pack of 100,Heavy duty chemical resistant hand protection,Safety & PPE,boxes,40\r\n`;
    downloadSample('sample_items_import.csv', sample);
  };

  const downloadReceiptSample = () => {
    const sample = `Location Code,SKU,Quantity,Notes\r\n` +
      `WH-MAIN,ELEC-CBL-001,100,Weekly supplier delivery from ElectroCorp\r\n` +
      `WH-MAIN,PLUMB-VLV-002,50,Standard restocking batch PO#44091\r\n` +
      `WH-NORTH,SAFE-GLV-003,30,Transit depot PPE safety replenishment\r\n`;
    downloadSample('sample_receipts_import.csv', sample);
  };

  // Submit Items Import
  const handleItemImport = async () => {
    try {
      setItemError(null);
      setItemResult(null);

      let csvText = '';
      if (useItemPaste) {
        csvText = itemCsvText.trim();
      } else if (itemFile) {
        csvText = await itemFile.text();
      }

      if (!csvText) {
        setItemError('Please select a CSV file or enter CSV data.');
        return;
      }

      setImportingItems(true);

      const res = await fetch('/api/csv/import-items', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        credentials: 'include',
        body: csvText,
      });

      const data = await res.json();

      if (!res.ok) {
        setItemError(data.error || 'Failed to import items.');
        return;
      }

      setItemResult(data);
    } catch (err: any) {
      setItemError(err.message || 'An unexpected error occurred during import.');
    } finally {
      setImportingItems(false);
    }
  };

  // Submit Receipts Import
  const handleReceiptImport = async () => {
    try {
      setReceiptError(null);
      setReceiptResult(null);

      let csvText = '';
      if (useReceiptPaste) {
        csvText = receiptCsvText.trim();
      } else if (receiptFile) {
        csvText = await receiptFile.text();
      }

      if (!csvText) {
        setReceiptError('Please select a CSV file or enter CSV data.');
        return;
      }

      setImportingReceipts(true);

      const res = await fetch('/api/csv/import-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        credentials: 'include',
        body: csvText,
      });

      const data = await res.json();

      if (!res.ok) {
        setReceiptError(data.error || 'Failed to import receipts.');
        return;
      }

      setReceiptResult(data);
    } catch (err: any) {
      setReceiptError(err.message || 'An unexpected error occurred during import.');
    } finally {
      setImportingReceipts(false);
    }
  };

  const isManager = user?.role === 'MANAGER';

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Bulk CSV Engine & Data Operations</h1>
          <p className={styles.subtitle}>
            Bulk ingest catalog items, record warehouse stock receipts with row-level RBAC validation, and export real-time ledger stock positions.
          </p>
        </div>
      </div>

      {/* Real-time Stock Export Card */}
      <div className={styles.exportCard}>
        <div className={styles.exportInfo}>
          <div className={styles.exportIconWrapper}>
            <Download size={24} />
          </div>
          <div>
            <div className={styles.exportTitle}>Export Real-time Stock Positions</div>
            <div className={styles.exportDesc}>
              Download complete CSV snapshot of on-hand inventory balances with category, UOM, and reorder levels.
            </div>
          </div>
        </div>

        <div className={styles.exportControls}>
          <select 
            value={exportLocationId} 
            onChange={(e) => setExportLocationId(e.target.value)}
            className={styles.locationSelect}
          >
            <option value="all">All Warehouse Locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.code})
              </option>
            ))}
          </select>

          <button 
            onClick={handleExportStock} 
            disabled={exporting}
            className="btn btn-primary"
            style={{ gap: '0.5rem' }}
          >
            {exporting ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
            {exporting ? 'Generating CSV...' : 'Download CSV'}
          </button>
        </div>
      </div>

      {/* Import Section Tabs (Desktop) */}
      <div className={styles.desktopTabsNav}>
        <button
          onClick={() => setActiveTab('items')}
          className={`${styles.tabBtn} ${activeTab === 'items' ? styles.tabBtnActive : ''}`}
        >
          <Boxes size={16} />
          <span>Catalog Items Import</span>
          <span className="badge badge-manager" style={{ fontSize: '0.65rem', marginLeft: '0.3rem' }}>
            Manager Only
          </span>
        </button>

        <button
          onClick={() => setActiveTab('receipts')}
          className={`${styles.tabBtn} ${activeTab === 'receipts' ? styles.tabBtnActive : ''}`}
        >
          <Layers size={16} />
          <span>Stock Receipts Import</span>
          <span className="badge badge-staff" style={{ fontSize: '0.65rem', marginLeft: '0.3rem' }}>
            Staff RBAC
          </span>
        </button>
      </div>

      {/* Import Section Select (Mobile <= 640px) */}
      <div className={styles.mobileTabsSelectWrapper}>
        <select
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value as 'items' | 'receipts')}
          className={styles.mobileTabSelect}
          aria-label="Select operation"
        >
          <option value="items">Catalog Items Import (Manager Only)</option>
          <option value="receipts">Stock Receipts Import (Staff RBAC)</option>
        </select>
      </div>

      {/* Tab 1: Catalog Items Import */}
      {activeTab === 'items' && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <div className={styles.sectionTitle}>
                <Boxes size={20} color="var(--accent-primary)" />
                <span>Bulk Import Inventory Catalog Items</span>
              </div>
              <div className={styles.sectionDesc}>
                Import new item SKUs with category resolution, UOM, and reorder thresholds. Supports partial batch success with row-level diagnostics.
              </div>
            </div>

            <button onClick={downloadItemSample} className={styles.templateBtn}>
              <FileCode size={14} />
              <span>Download Sample CSV</span>
            </button>
          </div>

          {!isManager && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 10,
              color: '#f87171',
              marginBottom: '1.5rem',
              fontSize: '0.85rem'
            }}>
              <ShieldAlert size={20} style={{ flexShrink: 0 }} />
              <div>
                <strong>Manager Privileges Required:</strong> You are currently authenticated as Staff ({user?.email}). Catalog item creation is restricted to Managers. Use the Quick Switcher in the top right to switch to Manager (Elena).
              </div>
            </div>
          )}

          {/* Mode toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              CSV Format: <code>SKU,Name,Description,Category,UOM,Reorder Level</code>
            </span>
            <button
              onClick={() => setUseItemPaste(!useItemPaste)}
              className={styles.pasteToggle}
            >
              {useItemPaste ? 'Switch to File Upload' : 'Paste CSV text manually'}
            </button>
          </div>

          {!useItemPaste ? (
            <div>
              <input
                ref={itemFileInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setItemFile(e.target.files[0]);
                  }
                }}
              />

              {!itemFile ? (
                <div
                  className={`${styles.dropzone} ${itemDragActive ? styles.dropzoneActive : ''}`}
                  onClick={() => itemFileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setItemDragActive(true); }}
                  onDragLeave={() => setItemDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setItemDragActive(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      setItemFile(e.dataTransfer.files[0]);
                    }
                  }}
                >
                  <UploadCloud size={40} className={styles.dropzoneIcon} />
                  <div className={styles.dropzoneText}>Drag & drop Item CSV file here, or click to browse</div>
                  <div className={styles.dropzoneHint}>Supports .csv files up to 10MB</div>
                </div>
              ) : (
                <div className={styles.fileChosenArea}>
                  <div className={styles.fileName}>
                    <FileText size={18} color="var(--accent-primary)" />
                    <span>{itemFile.name}</span>
                    <span className={styles.fileSize}>({(itemFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    onClick={() => setItemFile(null)}
                    className="btn btn-secondary"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  >
                    <X size={14} /> Remove
                  </button>
                </div>
              )}
            </div>
          ) : (
            <textarea
              className={styles.csvTextarea}
              placeholder="Paste raw CSV content here... (e.g. SKU,Name,Description,Category,UOM,Reorder Level)"
              value={itemCsvText}
              onChange={(e) => setItemCsvText(e.target.value)}
            />
          )}

          {itemError && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#f87171',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              padding: '0.75rem 1rem',
              borderRadius: 8,
              fontSize: '0.85rem',
              marginBottom: '1rem'
            }}>
              <AlertTriangle size={18} />
              <span>{itemError}</span>
            </div>
          )}

          <div className={styles.actionRow}>
            <button
              onClick={handleItemImport}
              disabled={importingItems || !isManager || (!itemFile && !itemCsvText.trim())}
              className="btn btn-primary"
            >
              {importingItems ? <RefreshCw size={16} className="animate-spin" /> : <FileUp size={16} />}
              {importingItems ? 'Processing Batch...' : 'Process Item Import'}
            </button>
          </div>

          {/* Diagnostic Results */}
          {itemResult && (
            <div className={styles.resultsBox}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                Import Processing Report
              </div>

              <div className={styles.summaryCards}>
                <div className={styles.statCard}>
                  <div className={styles.statValue}>{itemResult.totalRows}</div>
                  <div className={styles.statLabel}>Total Rows</div>
                </div>
                <div className={styles.statCard} style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                  <div className={styles.statValue} style={{ color: '#34d399' }}>{itemResult.successCount}</div>
                  <div className={styles.statLabel}>Imported</div>
                </div>
                <div className={styles.statCard} style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                  <div className={styles.statValue} style={{ color: '#f87171' }}>{itemResult.failureCount}</div>
                  <div className={styles.statLabel}>Failed</div>
                </div>
              </div>

              {itemResult.errors && itemResult.errors.length > 0 ? (
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f87171', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <AlertTriangle size={16} />
                    <span>Row-Level Diagnostics & Failure Explanations ({itemResult.errors.length})</span>
                  </div>
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Row #</th>
                          <th>SKU</th>
                          <th>Name</th>
                          <th>Status</th>
                          <th>Validation Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemResult.errors.map((err, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{err.row}</td>
                            <td><code>{err.sku || 'N/A'}</code></td>
                            <td>{err.name || 'N/A'}</td>
                            <td>
                              <span className={styles.badgeError}>REJECTED</span>
                            </td>
                            <td style={{ color: '#fca5a5' }}>{err.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: '#34d399',
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '0.75rem 1rem',
                  borderRadius: 8,
                  fontSize: '0.85rem'
                }}>
                  <CheckCircle2 size={18} />
                  <span>All {itemResult.successCount} items were successfully imported with 0 errors!</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Stock Receipts Import */}
      {activeTab === 'receipts' && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <div className={styles.sectionTitle}>
                <Layers size={20} color="var(--accent-secondary)" />
                <span>Bulk Import Stock Receipts</span>
              </div>
              <div className={styles.sectionDesc}>
                Record bulk inventory shipments into specific warehouse locations. Staff location assignments are strictly enforced per row.
              </div>
            </div>

            <button onClick={downloadReceiptSample} className={styles.templateBtn}>
              <FileCode size={14} />
              <span>Download Sample CSV</span>
            </button>
          </div>

          {!isManager && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.85rem 1rem',
              background: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              borderRadius: 10,
              color: 'var(--accent-secondary)',
              marginBottom: '1.5rem',
              fontSize: '0.85rem'
            }}>
              <CheckCircle2 size={20} style={{ flexShrink: 0 }} />
              <div>
                <strong>Location RBAC Active:</strong> You are logged in as Staff ({user?.email}). You can record receipts for your assigned warehouse locations. Rows referencing unassigned locations will be rejected and reported individually.
              </div>
            </div>
          )}

          {/* Mode toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              CSV Format: <code>Location Code,SKU,Quantity,Notes</code>
            </span>
            <button
              onClick={() => setUseReceiptPaste(!useReceiptPaste)}
              className={styles.pasteToggle}
            >
              {useReceiptPaste ? 'Switch to File Upload' : 'Paste CSV text manually'}
            </button>
          </div>

          {!useReceiptPaste ? (
            <div>
              <input
                ref={receiptFileInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setReceiptFile(e.target.files[0]);
                  }
                }}
              />

              {!receiptFile ? (
                <div
                  className={`${styles.dropzone} ${receiptDragActive ? styles.dropzoneActive : ''}`}
                  onClick={() => receiptFileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setReceiptDragActive(true); }}
                  onDragLeave={() => setReceiptDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setReceiptDragActive(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      setReceiptFile(e.dataTransfer.files[0]);
                    }
                  }}
                >
                  <UploadCloud size={40} className={styles.dropzoneIcon} />
                  <div className={styles.dropzoneText}>Drag & drop Receipts CSV file here, or click to browse</div>
                  <div className={styles.dropzoneHint}>Supports .csv files up to 10MB</div>
                </div>
              ) : (
                <div className={styles.fileChosenArea}>
                  <div className={styles.fileName}>
                    <FileText size={18} color="var(--accent-secondary)" />
                    <span>{receiptFile.name}</span>
                    <span className={styles.fileSize}>({(receiptFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    onClick={() => setReceiptFile(null)}
                    className="btn btn-secondary"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  >
                    <X size={14} /> Remove
                  </button>
                </div>
              )}
            </div>
          ) : (
            <textarea
              className={styles.csvTextarea}
              placeholder="Paste raw CSV content here... (e.g. Location Code,SKU,Quantity,Notes)"
              value={receiptCsvText}
              onChange={(e) => setReceiptCsvText(e.target.value)}
            />
          )}

          {receiptError && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#f87171',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              padding: '0.75rem 1rem',
              borderRadius: 8,
              fontSize: '0.85rem',
              marginBottom: '1rem'
            }}>
              <AlertTriangle size={18} />
              <span>{receiptError}</span>
            </div>
          )}

          <div className={styles.actionRow}>
            <button
              onClick={handleReceiptImport}
              disabled={importingReceipts || (!receiptFile && !receiptCsvText.trim())}
              className="btn btn-primary"
            >
              {importingReceipts ? <RefreshCw size={16} className="animate-spin" /> : <Layers size={16} />}
              {importingReceipts ? 'Processing Batch...' : 'Process Receipts Import'}
            </button>
          </div>

          {/* Diagnostic Results */}
          {receiptResult && (
            <div className={styles.resultsBox}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                Receipts Processing Report
              </div>

              <div className={styles.summaryCards}>
                <div className={styles.statCard}>
                  <div className={styles.statValue}>{receiptResult.totalRows}</div>
                  <div className={styles.statLabel}>Total Rows</div>
                </div>
                <div className={styles.statCard} style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                  <div className={styles.statValue} style={{ color: '#34d399' }}>{receiptResult.successCount}</div>
                  <div className={styles.statLabel}>Receipts Ingested</div>
                </div>
                <div className={styles.statCard} style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                  <div className={styles.statValue} style={{ color: '#f87171' }}>{receiptResult.failureCount}</div>
                  <div className={styles.statLabel}>Failed Rows</div>
                </div>
              </div>

              {receiptResult.errors && receiptResult.errors.length > 0 ? (
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f87171', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <AlertTriangle size={16} />
                    <span>Row-Level Diagnostics & RBAC Rejections ({receiptResult.errors.length})</span>
                  </div>
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Row #</th>
                          <th>Location Code</th>
                          <th>SKU</th>
                          <th>Qty</th>
                          <th>Status</th>
                          <th>Validation / RBAC Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receiptResult.errors.map((err, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{err.row}</td>
                            <td><code>{err.location || 'N/A'}</code></td>
                            <td><code>{err.sku || 'N/A'}</code></td>
                            <td>{err.quantity || 'N/A'}</td>
                            <td>
                              <span className={styles.badgeError}>REJECTED</span>
                            </td>
                            <td style={{ color: '#fca5a5' }}>{err.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: '#34d399',
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '0.75rem 1rem',
                  borderRadius: 8,
                  fontSize: '0.85rem'
                }}>
                  <CheckCircle2 size={18} />
                  <span>All {receiptResult.successCount} receipts successfully ingested into the ledger!</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default ImportExportPage;
