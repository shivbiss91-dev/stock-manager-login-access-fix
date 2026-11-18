import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  FileCode,
  Layers,
  Users,
  Package,
  ArrowLeftRight,
} from 'lucide-react';
import { backupService, DatabaseSnapshot } from '../../services/backupService';
import { useNotificationStore } from '../../store/notificationStore';
import { apiRequest } from '../../services/api';

interface DbInfo {
  engine: string;
  dbPath: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  counts: {
    users: number;
    items: number;
    stockMovements: number;
    warehouses: number;
  };
}

export const BackupPage: React.FC = () => {
  const { addNotification } = useNotificationStore();
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [pendingRestoreContent, setPendingRestoreContent] = useState<string | null>(null);
  const [restoreModalData, setRestoreModalData] = useState<DatabaseSnapshot['metadata'] | null>(null);
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  const [clientStats, setClientStats] = useState({
    items: 0,
    parties: 0,
    warehouses: 0,
  });

  const loadDatabaseDetails = async () => {
    try {
      const info = await apiRequest<DbInfo>('/backup/info', 'GET');
      if (info) {
        setDbInfo(info);
      }
    } catch {
      // Backend not running (e.g. static preview)
    }

    try {
      const snapshot = await backupService.generateSnapshot();
      setClientStats({
        items: snapshot.metadata.itemsCount,
        parties: snapshot.metadata.customersCount + snapshot.metadata.suppliersCount,
        warehouses: snapshot.metadata.warehousesCount,
      });
    } catch {}
  };

  useEffect(() => {
    loadDatabaseDetails();
  }, []);

  // Direct SQLite .db file download
  const handleDownloadSqliteFile = () => {
    const link = document.createElement('a');
    link.href = '/api/backup/download-db';
    link.download = `stockvista_backup_${new Date().toISOString().slice(0, 10)}.db`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addNotification({
      title: 'SQLite Database Download Initiated',
      message: 'Downloading raw stockvista.db file from the server.',
      type: 'success',
    });
  };

  // JSON Snapshot export
  const handleDownloadSnapshot = async () => {
    setIsExporting(true);
    try {
      const snapshot = await backupService.generateSnapshot();
      const jsonStr = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `StockVista_Snapshot_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);

      addNotification({
        title: 'JSON Database Snapshot Created',
        message: `Successfully exported ${snapshot.metadata.itemsCount} catalog items and all ledger transactions.`,
        type: 'success',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      addNotification({ title: 'Backup Error', message: msg, type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = backupService.validateSnapshot(content);
      setIsRestoring(false);

      if (res.success && res.metadata) {
        setPendingRestoreContent(content);
        setRestoreModalData(res.metadata);
      } else {
        setPendingRestoreContent(null);
        addNotification({
          title: 'Invalid Snapshot',
          message: res.error || 'The uploaded file could not be parsed as a StockVista backup.',
          type: 'error',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmRestore = async () => {
    if (!pendingRestoreContent) return;
    setIsRestoring(true);
    try {
      const res = await backupService.restoreSnapshot(pendingRestoreContent);
      if (res.success) {
        setRestoreModalData(null);
        setPendingRestoreContent(null);
        loadDatabaseDetails();
        addNotification({
          title: 'Database Restored',
          message: 'All records and master schemas have been synced with the snapshot.',
          type: 'success',
        });
      } else {
        addNotification({
          title: 'Restore Failed',
          message: res.error || 'Failed to apply backup snapshot.',
          type: 'error',
        });
      }
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-orange/10 rounded-xl text-brand-orange border border-brand-orange/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                Database Backup & SQLite Management
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time SQLite storage, instant .db exports, schema snapshots, and server restoration.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 text-xs font-semibold border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            SQLite 3 Active (WAL Mode)
          </span>
        </div>
      </div>

      {/* Primary Management Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Card */}
        <div className="template-card border border-slate-200 dark:border-white/[0.06] rounded-[20px] p-6 shadow-soft space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 text-accent-blue rounded-xl border border-blue-500/20">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Export Database
                </h3>
                <p className="text-xs text-slate-400">
                  Download raw SQLite binary file or structured JSON snapshot of all inventory and users.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-white/[0.02] p-3.5 rounded-xl border border-slate-100 dark:border-white/[0.06] space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Database File Location:</span>
                <strong className="font-mono text-slate-900 dark:text-white">data/stockvista.db</strong>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Database Engine:</span>
                <strong className="text-accent-blue font-mono">SQLite 3 (Native Synchronous)</strong>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Catalog Items:</span>
                <strong className="text-slate-900 dark:text-white">
                  {dbInfo ? dbInfo.counts.items : clientStats.items} SKUs
                </strong>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>User Accounts:</span>
                <strong className="text-slate-900 dark:text-white">
                  {dbInfo ? dbInfo.counts.users : '2'} Accounts (Isolated Table)
                </strong>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
            <button
              onClick={handleDownloadSqliteFile}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-sm border border-slate-700"
            >
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <span>Download .db File</span>
            </button>

            <button
              onClick={handleDownloadSnapshot}
              disabled={isExporting}
              className="py-2.5 px-3 rounded-xl bg-accent-orange text-white hover:bg-accent-orange/90 font-semibold text-xs transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
              <span>{isExporting ? 'Exporting...' : 'Export JSON Snapshot'}</span>
            </button>
          </div>
        </div>

        {/* Restore Card */}
        <div className="template-card border border-slate-200 dark:border-white/[0.06] rounded-[20px] p-6 shadow-soft space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Restore Database
                </h3>
                <p className="text-xs text-slate-400">
                  Upload a previously exported snapshot or backup archive to recover all records.
                </p>
              </div>
            </div>

            <div className="border-2 border-dashed border-slate-200 dark:border-white/[0.08] rounded-xl p-6 text-center bg-slate-50 dark:bg-white/[0.01] space-y-2">
              <FileCode className="w-8 h-8 mx-auto text-slate-400" />
              <div>
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 template-input border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs font-semibold text-accent-orange hover:border-accent-orange/40 transition">
                  <span>Browse Backup File</span>
                  <input
                    type="file"
                    accept=".json,.db,.sqlite"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-[11px] text-slate-400">
                Supports StockVista JSON snapshot files (.json) and SQLite database files (.db)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-amber-500 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Restoring synchronizes the active state with the snapshot archive contents.</span>
          </div>
        </div>
      </div>

      {/* Realistic SQLite Storage Architecture */}
      <div className="template-card border border-slate-200 dark:border-white/[0.06] rounded-[20px] p-6 shadow-soft space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent-orange" />
            <span>SQLite Database Architecture & Storage Tables</span>
          </h3>
          <p className="text-xs text-slate-400">
            Clean, relational tables designed for high-concurrency server environments without credential-product overlap.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <span className="font-bold text-xs text-slate-900 dark:text-white">users Table</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                Isolated
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Admin & staff credentials, login methods, and granular role permissions.
            </p>
            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200 dark:border-white/[0.06]">
              Columns: id, email, password, role, login_method, status
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-accent-orange" />
                <span className="font-bold text-xs text-slate-900 dark:text-white">items Table</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                Indexed
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Inventory product master, SKU, prices, stock levels, and warehouse mapping.
            </p>
            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200 dark:border-white/[0.06]">
              Columns: id, name, sku, current_stock, selling_price, unit
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-accent-blue" />
                <span className="font-bold text-xs text-slate-900 dark:text-white">stock_movements Table</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                Audited
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Double-entry movement ledger recording calibration additions, deductions, and user stamps.
            </p>
            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200 dark:border-white/[0.06]">
              Columns: id, item_id, delta, previous_stock, resulting_stock, date
            </div>
          </div>
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {restoreModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md template-card border border-slate-200 dark:border-white/[0.08] rounded-[24px] shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-2 text-emerald-500">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Snapshot Verified Successfully
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              The backup archive contains the following entities ready for restoration:
            </p>

            <div className="bg-slate-50 dark:bg-white/[0.02] p-4 rounded-xl border border-slate-200 dark:border-white/[0.06] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Master Catalog Items:</span>
                <strong className="text-slate-900 dark:text-white">{restoreModalData.itemsCount}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Registered Customers:</span>
                <strong className="text-slate-900 dark:text-white">{restoreModalData.customersCount}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Registered Suppliers:</span>
                <strong className="text-slate-900 dark:text-white">{restoreModalData.suppliersCount}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tax Invoices:</span>
                <strong className="text-slate-900 dark:text-white">{restoreModalData.invoicesCount}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Regional Warehouses:</span>
                <strong className="text-slate-900 dark:text-white">{restoreModalData.warehousesCount}</strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => {
                  setRestoreModalData(null);
                  setPendingRestoreContent(null);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRestoring}
                onClick={confirmRestore}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-accent-orange text-white hover:bg-accent-orange/90 transition shadow-sm"
              >
                {isRestoring ? 'Restoring...' : 'Apply Restoration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupPage;
