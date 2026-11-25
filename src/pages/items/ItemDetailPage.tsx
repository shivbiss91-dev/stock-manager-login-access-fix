import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit3,
  ArrowRightLeft,
  Printer,
  Package,
  Layers,
  Calendar,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ChevronRight,
  Maximize2,
  Lock,
  Plus,
  Minus,
  Sliders,
  Trash2,
  History,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
} from 'lucide-react';
import { QuickStockAdjustmentModal } from '../../components/dashboard/QuickStockAdjustmentModal';
import { EditMovementModal } from '../../components/itemDetail/EditMovementModal';
import { stockMovementService } from '../../services/stockMovementService';
import { StockMovementRecord } from '../../types/itemDetail';
import { formatPackagingBreakdown } from '../../utils/unitConversions';
import { inventoryService } from '../../services/inventoryService';
import { ComputedInventoryItem } from '../../types/inventory';
import { useAuthStore } from '../../store/authStore';
import { formatINR } from '../../utils/formatINR';
import { formatCategoryName } from '../../data/materialCategories';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import { EditItemModal } from '../../components/itemDetail/EditItemModal';
import { ProductImage } from '../../components/common/ProductImage';
import { TransferStockModal } from '../../components/itemDetail/TransferStockModal';
import { BarcodeLabelModal } from '../../components/itemDetail/BarcodeLabelModal';
import { useNotificationStore } from '../../store/notificationStore';

export const ItemDetailPage: React.FC = () => {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addNotification } = useNotificationStore();

  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  // Item state
  const [item, setItem] = useState<ComputedInventoryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isImageZoomed, setIsImageZoomed] = useState(false);

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [adjustmentMode, setAdjustmentMode] = useState<'add' | 'deduct' | 'direct'>('add');

  // Movement history state
  const [movements, setMovements] = useState<StockMovementRecord[]>([]);
  const [isLoadingMovements, setIsLoadingMovements] = useState(false);
  const [movementFilter, setMovementFilter] = useState<'all' | 'add' | 'deduct' | 'adjustment'>('all');
  const [editingMovement, setEditingMovement] = useState<StockMovementRecord | null>(null);
  const [isEditMovementModalOpen, setIsEditMovementModalOpen] = useState(false);

  const loadMovements = async (targetItemId?: string) => {
    const id = targetItemId || itemId;
    if (!id) return;
    setIsLoadingMovements(true);
    try {
      const data = await stockMovementService.getMovements({ itemId: id });
      setMovements(data);
    } catch (err) {
      console.error('Failed to load item movements:', err);
    } finally {
      setIsLoadingMovements(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!item) return;
    setIsDeleting(true);
    try {
      await inventoryService.deleteItem(item.id);
      addNotification({
        title: 'Item Deleted',
        message: `${item.name} (${item.sku}) was deleted from the catalogue.`,
        type: 'info',
      });
      navigate('/items');
    } catch (err) {
      console.error('Failed to delete item:', err);
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  const handleAdjustmentSuccess = async () => {
    if (!itemId) return;
    const reloaded = await inventoryService.getItemById(itemId);
    if (reloaded) setItem(reloaded);
    await loadMovements(itemId);
  };

  const handleMovementUpdated = async () => {
    if (!itemId) return;
    const reloaded = await inventoryService.getItemById(itemId);
    if (reloaded) setItem(reloaded);
    await loadMovements(itemId);
    setIsEditMovementModalOpen(false);
    setEditingMovement(null);
  };

  // Load item data & movements
  useEffect(() => {
    let isMounted = true;
    async function loadItem() {
      if (!itemId) return;
      setIsLoading(true);
      try {
        const found = await inventoryService.getItemById(itemId);
        if (isMounted) {
          setItem(found);
        }
      } catch (err) {
        console.error('Failed to load item detail:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadItem();
    loadMovements(itemId);

    const handleStockUpdate = (e: any) => {
      if (!itemId || (e.detail?.itemId && e.detail.itemId !== itemId)) return;
      inventoryService.getItemById(itemId).then((reloaded) => {
        if (reloaded) setItem(reloaded);
      });
      loadMovements(itemId);
    };

    window.addEventListener('stock_updated', handleStockUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('stock_updated', handleStockUpdate);
    };
  }, [itemId]);

  const filteredMovements = useMemo(() => {
    if (movementFilter === 'all') return movements;
    if (movementFilter === 'add') return movements.filter((m) => m.quantityDelta > 0);
    if (movementFilter === 'deduct') return movements.filter((m) => m.quantityDelta < 0);
    if (movementFilter === 'adjustment') return movements.filter((m) => m.type === 'adjustment');
    return movements;
  }, [movements, movementFilter]);

  // Margin calculation for Admin
  const profitMarginPercent = useMemo(() => {
    if (!item || item.sellingPrice <= 0) return 0;
    const diff = item.sellingPrice - item.costPrice;
    return Math.round((diff / item.sellingPrice) * 1000) / 10;
  }, [item]);

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-6 w-72 bg-slate-200 dark:bg-slate-800 rounded"></div>
        <div className="h-12 w-full bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
          <div className="lg:col-span-2 h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-12 text-center max-w-md mx-auto space-y-4">
        <Package className="w-16 h-16 mx-auto text-slate-400" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Item Not Found</h2>
        <p className="text-sm text-slate-500">
          The item identifier <code className="font-mono text-primary-500">{itemId}</code> was not found in the inventory ledger.
        </p>
        <Link
          to="/items"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Items & Products</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* 1. Breadcrumbs & Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          <Link to="/dashboard" className="hover:text-primary-600 dark:hover:text-accent-teal transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link to="/items" className="hover:text-primary-600 dark:hover:text-accent-teal transition-colors">
            Items & Products
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link
            to={`/items?category=${item.materialCategory}`}
            className="capitalize hover:text-primary-600 dark:hover:text-accent-teal transition-colors"
          >
            {formatCategoryName(item.materialCategory)}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-800 dark:text-white truncate max-w-[200px] sm:max-w-xs">
            {item.name}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Edit / Request Edit button */}
          <button
            onClick={() => setIsEditModalOpen(true)}
            className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-xl border transition-all flex items-center gap-1.5 ${
              isAdmin
                ? 'template-input border border-slate-300 dark:border-white/[0.08] text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05]'
                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>{isAdmin ? 'Edit Item' : 'Request Edit'}</span>
            {isAdmin ? (
              <span className="text-[10px] bg-accent-orange/20 text-accent-orange px-1.5 py-0.5 rounded font-bold">
                ADMIN
              </span>
            ) : (
              <span className="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-bold">
                REQ
              </span>
            )}
          </button>

          {/* Quick Adjust Stock */}
          <button
            onClick={() => {
              setAdjustmentMode('add');
              setIsAdjustmentModalOpen(true);
            }}
            className="px-3.5 py-2 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 dark:border-white/[0.08] template-input text-slate-700 dark:text-slate-200 hover:text-white transition flex items-center gap-1.5"
            title="Perform manual stock adjustment (+ / -) or direct calibration"
          >
            <ArrowRightLeft className="w-4 h-4 text-emerald-500" />
            <span>Adjust Stock</span>
          </button>

          {/* Print Label */}
          <button
            onClick={() => setIsLabelModalOpen(true)}
            className="px-3.5 py-2 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 dark:border-white/[0.08] template-input text-slate-700 dark:text-slate-200 hover:text-white transition flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4 text-slate-400" />
            <span>Print Label</span>
          </button>

          {/* Delete Item button */}
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="px-3.5 py-2 text-xs sm:text-sm font-medium rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition flex items-center gap-1.5"
            title="Delete this product from catalog"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* 2. Top Header Grid: Gallery & Info Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Product Images Gallery (5 cols) */}
        <div className="lg:col-span-5 template-card border border-slate-200 dark:border-white/[0.06] rounded-[20px] p-4 sm:p-5 shadow-soft space-y-4">
          <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/[0.06] flex items-center justify-center group">
            <ProductImage
              src={item.images[selectedImageIndex] || item.images[0]}
              alt={item.name}
              category={item.materialCategory}
              className={`w-full h-full object-cover transition-transform duration-300 ${
                isImageZoomed ? 'scale-150 cursor-zoom-out' : 'group-hover:scale-105 cursor-zoom-in'
              }`}
            />

            {/* Category Chip */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-black/60 backdrop-blur-md text-white capitalize border border-white/20">
                {formatCategoryName(item.materialCategory)}
              </span>
            </div>

            {/* Zoom hint */}
            <button
              onClick={() => setIsImageZoomed(!isImageZoomed)}
              className="absolute bottom-3 right-3 p-1.5 rounded-lg bg-black/50 text-white backdrop-blur-md opacity-80 hover:opacity-100 transition-opacity"
              title="Click to zoom"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Thumbnails row */}
          {item.images.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              {item.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedImageIndex(idx);
                    setIsImageZoomed(false);
                  }}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                    selectedImageIndex === idx
                      ? 'border-accent-orange scale-105 shadow-md'
                      : 'border-slate-200 dark:border-white/[0.08] opacity-60 hover:opacity-100'
                  }`}
                >
                  <ProductImage src={img} alt={`Thumbnail ${idx + 1}`} category={item.materialCategory} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Quick Specifications list */}
          <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
            <div className="flex justify-between">
              <span>Unit of Measure:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{item.unit}</span>
            </div>
            {item.hsnCode ? (
              <div className="flex justify-between">
                <span>HSN Classification:</span>
                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{item.hsnCode}</span>
              </div>
            ) : null}
            {item.gstRate > 0 ? (
              <div className="flex justify-between">
                <span>GST Tax Slab:</span>
                <span className="font-semibold text-accent-orange">{item.gstRate}%</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right: Master Info Card (7 cols) */}
        <div className="lg:col-span-7 template-card border border-slate-200 dark:border-white/[0.06] rounded-[20px] p-5 sm:p-6 shadow-soft space-y-5">
          {/* Header & Badges */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {item.sku}
              </span>

              {/* Status Badge (Only In Stock or Out of Stock) */}
              <span
                className={`px-2.5 py-0.5 text-xs font-semibold rounded-full capitalize ${
                  item.currentStock > 0 && item.stockStatus !== 'out_of_stock'
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                }`}
              >
                ● {item.currentStock > 0 && item.stockStatus !== 'out_of_stock' ? 'In Stock' : 'Out of Stock'}
              </span>

              <span className="text-xs text-slate-400 ml-auto flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Updated {formatDate(item.updatedAt)}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
              {item.name}
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
              {item.description}
            </p>
          </div>

          {/* Pricing & Stock Highlight Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-slate-100 dark:border-white/[0.06]">
            {/* Selling Price */}
            <div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Wholesale Price</p>
              <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                {formatINR(item.sellingPrice)}
              </p>
              <p className="text-[10px] text-slate-400">excl. {item.gstRate}% GST</p>
            </div>

            {/* Current Stock with manual controls & packaging conversion */}
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Available Stock</p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustmentMode('deduct');
                      setIsAdjustmentModalOpen(true);
                    }}
                    className="w-5 h-5 rounded flex items-center justify-center bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white transition-colors border border-rose-500/20"
                    title="Manual Deduct Stock (-)"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustmentMode('add');
                      setIsAdjustmentModalOpen(true);
                    }}
                    className="w-5 h-5 rounded flex items-center justify-center bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white transition-colors border border-emerald-500/20"
                    title="Manual Add Stock (+)"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setAdjustmentMode('direct');
                  setIsAdjustmentModalOpen(true);
                }}
                className={`text-base sm:text-lg font-bold mt-0.5 block text-left hover:text-accent-orange transition-colors ${
                  item.currentStock <= item.reorderLevel
                    ? 'text-amber-500'
                    : 'text-emerald-500'
                }`}
                title="Click to directly edit inventory count"
              >
                {item.currentStock.toLocaleString('en-IN')}{' '}
                <span className="text-xs font-normal text-slate-500">{item.unit}</span>
              </button>

              <p className="text-[10px] text-slate-400 mt-0.5">
                Reorder: <strong>{item.reorderLevel} {item.unit}</strong> • PO Qty:{' '}
                <strong>{item.reorderQuantity || item.reorderLevel * 2} {item.unit}</strong>
              </p>
            </div>

            {/* Admin Only: Cost Price */}
            <div>
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Cost Price</p>
                {!isAdmin && <Lock className="w-2.5 h-2.5 text-slate-400" />}
              </div>
              {isAdmin ? (
                <>
                  <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                    {formatINR(item.costPrice)}
                  </p>
                  <p className="text-[10px] text-accent-orange font-medium">ADMIN ONLY</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold text-slate-400 mt-1">••••••</p>
                  <p className="text-[10px] text-slate-400">Restricted</p>
                </>
              )}
            </div>

            {/* Admin Only: Margin */}
            <div>
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Margin</p>
                {!isAdmin && <Lock className="w-2.5 h-2.5 text-slate-400" />}
              </div>
              {isAdmin ? (
                <>
                  <p className="text-base sm:text-lg font-bold text-emerald-500 mt-0.5">
                    {profitMarginPercent}%
                  </p>
                  <p className="text-[10px] text-slate-400">
                    +{formatINR(item.sellingPrice - item.costPrice)} / {item.unit}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold text-slate-400 mt-1">••••••</p>
                  <p className="text-[10px] text-slate-400">Restricted</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>



      {/* 3. Item-Specific Stock Movement & Calibration History */}
      <div className="template-card border border-slate-200 dark:border-white/[0.06] rounded-[20px] p-5 sm:p-6 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-accent-orange/10 text-accent-orange">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Stock Movement & Calibration History
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                  {movements.length} {movements.length === 1 ? 'Record' : 'Records'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Item-specific audit ledger: additions (+), deductions (-), transfers, and calibrations with live stock recalculation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter buttons */}
            <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] text-xs">
              <button
                type="button"
                onClick={() => setMovementFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  movementFilter === 'all'
                    ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setMovementFilter('add')}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  movementFilter === 'add'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-emerald-500'
                }`}
              >
                + Additions
              </button>
              <button
                type="button"
                onClick={() => setMovementFilter('deduct')}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  movementFilter === 'deduct'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-rose-500'
                }`}
              >
                - Deductions
              </button>
              <button
                type="button"
                onClick={() => setMovementFilter('adjustment')}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  movementFilter === 'adjustment'
                    ? 'bg-accent-blue text-white shadow-sm'
                    : 'text-slate-500 hover:text-blue-500'
                }`}
              >
                Calibrations
              </button>
            </div>

            <button
              type="button"
              onClick={() => loadMovements(item.id)}
              disabled={isLoadingMovements}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-500 transition cursor-pointer"
              title="Refresh ledger records"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingMovements ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        {filteredMovements.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 font-semibold">
                  <th className="pb-2.5 pr-3">Date & Time</th>
                  <th className="pb-2.5 px-3">Operation / Type</th>
                  <th className="pb-2.5 px-3">Adjustment Delta</th>
                  <th className="pb-2.5 px-3">Resulting Balance</th>
                  <th className="pb-2.5 px-3">Reference / Reason</th>
                  <th className="pb-2.5 px-3">Authorized By</th>
                  <th className="pb-2.5 pl-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {filteredMovements.map((mov) => {
                  const isPositive = mov.quantityDelta > 0;
                  const isNegative = mov.quantityDelta < 0;
                  return (
                    <tr
                      key={mov.id}
                      className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Date & Time */}
                      <td className="py-3 pr-3 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDateTime(mov.date)}</span>
                        </div>
                      </td>

                      {/* Operation / Type Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-[11px] ${
                            isPositive
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : isNegative
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : isNegative ? (
                            <ArrowDownRight className="w-3 h-3" />
                          ) : (
                            <ArrowRightLeft className="w-3 h-3" />
                          )}
                          <span className="capitalize">
                            {isPositive
                              ? 'Stock Addition (+)'
                              : isNegative
                              ? 'Stock Deduction (-)'
                              : 'Stock Calibration'}
                          </span>
                        </span>
                      </td>

                      {/* Quantity Delta */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`text-sm font-extrabold font-mono ${
                            isPositive
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : isNegative
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {isPositive ? `+${mov.quantityDelta}` : mov.quantityDelta}{' '}
                          <span className="text-xs font-semibold">{mov.unit || item.unit}</span>
                        </span>
                      </td>

                      {/* Resulting Balance */}
                      <td className="py-3 px-3 text-slate-900 dark:text-white font-bold whitespace-nowrap">
                        {mov.stockAfter !== undefined
                          ? `${mov.stockAfter.toLocaleString('en-IN')} ${mov.unit || item.unit}`
                          : '-'}
                      </td>

                      {/* Reason / Reference */}
                      <td className="py-3 px-3 max-w-xs">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {mov.reason || mov.notes || 'Manual stock update'}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate font-mono">
                          Ref: {mov.referenceNumber}
                          {mov.notes && mov.notes !== mov.reason ? ` • ${mov.notes}` : ''}
                        </p>
                      </td>

                      {/* Authorized By */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <p className="font-medium text-slate-700 dark:text-slate-300">
                          {mov.userName || 'Authorized Staff'}
                        </p>
                        <span className="text-[10px] text-slate-400 capitalize">
                          {mov.userRole || 'Staff'}
                        </span>
                      </td>

                      {/* Action: Edit */}
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMovement(mov);
                            setIsEditMovementModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] hover:bg-accent-orange/10 hover:border-accent-orange/30 text-slate-700 dark:text-slate-300 hover:text-accent-orange transition-all font-semibold flex items-center gap-1.5 ml-auto cursor-pointer"
                          title="Edit this addition/deduction and recalculate stock without double-applying"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-accent-orange" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-white/[0.08] space-y-3">
            <Package className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
            <div>
              <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                No Stock Movements Recorded
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-0.5">
                Every confirmed addition, deduction, transfer, and calibration for this product will appear here in chronological order.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAdjustmentMode('add');
                setIsAdjustmentModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-accent-orange text-white hover:bg-accent-orange/90 transition shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record First Stock Addition / Deduction</span>
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {isEditModalOpen && (
        <EditItemModal
          item={item}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onItemUpdated={(updated) => setItem(updated)}
          onItemDeleted={() => navigate('/items')}
        />
      )}

      {/* Direct Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#05060A]/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md template-card border border-red-500/30 rounded-[24px] shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-500">
              <div className="p-3 rounded-xl bg-red-500/10">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Product</h3>
                <p className="text-xs text-slate-500 dark:text-[#9AA0AE]">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Are you sure you want to permanently delete <strong>{item?.name}</strong> ({item?.sku}) from the catalogue?
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm flex items-center gap-1.5"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isTransferModalOpen && (
        <TransferStockModal
          item={item}
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          onTransferComplete={async () => {
            const reloaded = await inventoryService.getItemById(item.id);
            if (reloaded) setItem(reloaded);
          }}
        />
      )}

      {isLabelModalOpen && (
        <BarcodeLabelModal
          item={item}
          isOpen={isLabelModalOpen}
          onClose={() => setIsLabelModalOpen(false)}
        />
      )}

      {isAdjustmentModalOpen && (
        <QuickStockAdjustmentModal
          item={item}
          isOpen={isAdjustmentModalOpen}
          initialMode={adjustmentMode}
          onClose={() => setIsAdjustmentModalOpen(false)}
          onSuccess={handleAdjustmentSuccess}
        />
      )}

      {isEditMovementModalOpen && editingMovement && (
        <EditMovementModal
          movement={editingMovement}
          item={item}
          isOpen={isEditMovementModalOpen}
          onClose={() => {
            setIsEditMovementModalOpen(false);
            setEditingMovement(null);
          }}
          onSuccess={handleMovementUpdated}
        />
      )}
    </div>
  );
};
