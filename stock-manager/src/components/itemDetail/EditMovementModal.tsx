import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { StockMovementRecord } from '../../types/itemDetail';
import { ComputedInventoryItem } from '../../types/inventory';
import { stockMovementService } from '../../services/stockMovementService';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import {
  ArrowRightLeft,
  AlertCircle,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';

interface EditMovementModalProps {
  movement: StockMovementRecord | null;
  item: ComputedInventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditMovementModal: React.FC<EditMovementModalProps> = ({
  movement,
  item,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuthStore();
  const { addNotification } = useNotificationStore();
  const isViewer = user?.role === 'viewer';

  const [mode, setMode] = useState<'add' | 'deduct'>('add');
  const [quantity, setQuantity] = useState<number>(1);
  const [date, setDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (movement && isOpen) {
      const isNegative = movement.quantityDelta < 0;
      setMode(isNegative ? 'deduct' : 'add');
      setQuantity(Math.abs(movement.quantityDelta) || 1);

      // Format ISO to YYYY-MM-DD or YYYY-MM-DDTHH:mm for datetime-local
      if (movement.date) {
        try {
          const d = new Date(movement.date);
          const pad = (n: number) => String(n).padStart(2, '0');
          const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          setDate(formatted);
        } catch {
          setDate(movement.date.slice(0, 16));
        }
      } else {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        setDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
      }

      setReason(movement.reason || '');
      setNotes(movement.notes || '');
      setError(null);
    }
  }, [movement, isOpen]);

  if (!movement || !item) return null;

  const oldDelta = movement.quantityDelta;
  const newDelta = mode === 'add' ? quantity : -quantity;
  const deltaDifference = newDelta - oldDelta;
  const recalculatedStock = item.currentStock + deltaDifference;
  const isNegativeStock = recalculatedStock < 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isViewer) {
      setError('Viewers have read-only access.');
      return;
    }

    if (quantity <= 0) {
      setError('Please specify a quantity greater than 0.');
      return;
    }

    if (isNegativeStock) {
      setError(
        `Negative stock is strictly forbidden. Resulting balance would be ${recalculatedStock} ${item.unit}. Available: ${item.currentStock} ${item.unit}.`
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const isoDate = date.includes('T') ? new Date(date).toISOString() : date;
      const result = await stockMovementService.updateMovement(movement.id, {
        quantityDelta: newDelta,
        reason: reason.trim() || undefined,
        notes: notes.trim() || undefined,
        date: isoDate,
        userName: user?.name || movement.userName,
        userRole: user?.role || movement.userRole,
      });

      addNotification({
        title: 'Movement Recalculated & Saved',
        message: `${item.name} stock updated to ${result.updatedStock.toLocaleString('en-IN')} ${item.unit} (net diff: ${deltaDifference >= 0 ? '+' : ''}${deltaDifference} ${item.unit}). No double-applying!`,
        type: 'success',
      });

      setIsLoading(false);
      onSuccess();
      onClose();
    } catch (err) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : 'Failed to update movement.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Stock Movement & Recalculate Balance"
      subtitle={`${item.name} (${item.sku}) • Ref: ${movement.referenceNumber}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Role Notice */}
        {isViewer && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-700 dark:text-amber-300">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>
              <strong>Read-Only Access:</strong> Your role (Viewer) cannot modify stock movements.
            </span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Current State Indicator */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between text-xs">
          <div>
            <span className="text-[11px] text-slate-400 block">Original Recorded Delta</span>
            <span
              className={`text-sm font-bold ${
                oldDelta > 0
                  ? 'text-emerald-500'
                  : oldDelta < 0
                  ? 'text-rose-500'
                  : 'text-slate-400'
              }`}
            >
              {oldDelta > 0 ? `+${oldDelta}` : oldDelta} {item.unit}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block">Current Item On-Hand Stock</span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-white">
              {item.currentStock.toLocaleString('en-IN')} {item.unit}
            </span>
          </div>
        </div>

        {/* Movement Type Toggle */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Adjustment Direction *
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('add')}
              className={`p-2.5 rounded-xl border text-center font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                mode === 'add'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                  : 'bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.06]'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>+ Inward Addition</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('deduct')}
              className={`p-2.5 rounded-xl border text-center font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                mode === 'deduct'
                  ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                  : 'bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.06]'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>- Outward Deduction</span>
            </button>
          </div>
        </div>

        {/* Quantity Input */}
        <div>
          <Input
            label={`Corrected Quantity (${item.unit}) *`}
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            required
          />
        </div>

        {/* Date & Time Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-accent-orange" />
            <span>Movement Date & Time *</span>
          </label>
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#1A1D26] px-3.5 py-2.5 text-slate-800 dark:text-[#F2F4F8] focus:outline-none focus:ring-2 focus:ring-accent-orange cursor-pointer"
            required
          />
        </div>

        {/* Reason / Reference */}
        <Input
          label="Adjustment Reason / Reference"
          placeholder="e.g. Audit correction, delivery lot update"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        {/* Notes */}
        <Input
          label="Verification Notes"
          placeholder="Additional context or count sheet reference"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {/* Recalculation Preview Card */}
        <div className="p-4 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
            <span>Previous Movement Delta:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {oldDelta > 0 ? `+${oldDelta}` : oldDelta} {item.unit}
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
            <span>New Corrected Delta:</span>
            <span
              className={`font-bold ${
                newDelta > 0
                  ? 'text-emerald-500'
                  : newDelta < 0
                  ? 'text-rose-500'
                  : 'text-slate-400'
              }`}
            >
              {newDelta > 0 ? `+${newDelta}` : newDelta} {item.unit}
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
            <span>Net Stock Difference Applied:</span>
            <span
              className={`font-bold font-mono ${
                deltaDifference > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : deltaDifference < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-400'
              }`}
            >
              {deltaDifference > 0 ? `+${deltaDifference}` : deltaDifference} {item.unit}
            </span>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-white/[0.08] flex justify-between items-center">
            <span className="font-bold text-slate-800 dark:text-slate-200">Recalculated Item Stock:</span>
            <span
              className={`text-base font-extrabold ${
                isNegativeStock
                  ? 'text-rose-500'
                  : recalculatedStock === 0
                  ? 'text-rose-500'
                  : recalculatedStock <= item.reorderLevel
                  ? 'text-amber-500'
                  : 'text-emerald-500 dark:text-accent-orange'
              }`}
            >
              {recalculatedStock.toLocaleString('en-IN')} {item.unit}
            </span>
          </div>

          {/* Guarantee Pill */}
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-start gap-1.5 mt-2">
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            <span>
              <strong>Zero Double-Applying Guarantee:</strong> The system replaces the original change by applying only the net delta difference ({deltaDifference >= 0 ? '+' : ''}{deltaDifference} {item.unit}).
            </span>
          </div>

          {/* Negative Warning */}
          {isNegativeStock && (
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Negative stock balance is strictly forbidden. Please adjust the quantity.</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
          <Button variant="outline" size="md" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            isLoading={isLoading}
            disabled={isViewer || isNegativeStock || quantity <= 0}
            leftIcon={<ArrowRightLeft className="w-4 h-4" />}
          >
            Save & Recalculate Stock
          </Button>
        </div>
      </form>
    </Modal>
  );
};
