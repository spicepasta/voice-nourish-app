import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Check, Edit3 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

// Token-optimized item schema
export interface TokenItem {
  qty: string;
  n: string;
  cal?: number;
  p?: number;
  c?: number;
  f?: number;
  fib?: number;
  // Micronutrients: [abbr]_[unit]
  [key: string]: string | number | undefined;
}

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: TokenItem[]; // Items from edge function
  onConfirm: (payload: { items: TokenItem[]; totals?: any }) => void;
}

const KNOWN_KEYS = new Set(["qty", "n", "cal", "p", "c", "f", "fib"]);

const ConfirmationModal = ({ isOpen, onClose, items, onConfirm }: ConfirmationModalProps) => {
  const [editItems, setEditItems] = useState<TokenItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Initialize local editable items whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setEditItems(Array.isArray(items) && items.length ? items.map(i => ({ ...i })) : [{ qty: '1 serving', n: '' }]);
    }
  }, [isOpen, items]);

  const micronutrientKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const it of editItems) {
      Object.keys(it).forEach(k => {
        if (!KNOWN_KEYS.has(k) && /^(?:[a-z]{1,4})_(?:mg|mcg|iu|g|mgdL|mmolL)$/i.test(k)) keys.add(k);
      });
    }
    return Array.from(keys);
  }, [editItems]);

  const updateItem = (index: number, field: string, value: string | number) => {
    const updated = [...editItems];
    updated[index] = { ...updated[index], [field]: value };
    setEditItems(updated);
  };

  const addFoodItem = () => {
    setEditItems([...editItems, { qty: '1 serving', n: '' }]);
  };

  const removeFoodItem = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const computeTotals = (list: TokenItem[]) => {
    const totals = list.reduce(
      (acc, it) => {
        acc.total_calories += Number(it.cal || 0);
        acc.protein += Number(it.p || 0);
        acc.carbs += Number(it.c || 0);
        acc.fat += Number(it.f || 0);
        acc.fiber += Number(it.fib || 0);
        // Aggregate micronutrients
        for (const [k, v] of Object.entries(it)) {
          if (!KNOWN_KEYS.has(k) && typeof v === 'number') {
            acc.micronutrients[k] = (acc.micronutrients[k] || 0) + v;
          }
        }
        return acc;
      },
      { total_calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, micronutrients: {} as Record<string, number> }
    );
    return totals;
  };

  const handleConfirm = async () => {
    if (!user) return;
    const invalid = editItems.some(it => !it.n || !it.qty);
    if (invalid) {
      toast({ variant: 'destructive', title: 'Missing details', description: 'Please fill in quantity and name for each item.' });
      return;
    }

    setLoading(true);
    try {
      // Compute meal-level totals client-side
      const totals = computeTotals(editItems);
      const meal_name = editItems.map(i => `${i.qty} ${i.n}`.trim()).filter(Boolean).join(', ');
      const description = meal_name;

      // Persist to Supabase if the meals table exists (best-effort)
      const { error } = await supabase.from('meals').insert({
        user_id: user.id,
        meal_name,
        description,
        total_calories: totals.total_calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        fiber: totals.fiber,
        micronutrients: totals.micronutrients,
      });
      if (error) {
        // Log but don't block user flow
        console.warn('Insert meals error (non-fatal):', error.message);
      }

      onConfirm({ items: editItems, totals });
    } catch (error) {
      console.error('Error saving meal:', error);
      toast({
        variant: 'destructive',
        title: 'Recording Error',
        description: 'Unable to save your meal. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm w-[92vw] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-butler-heading">If I May Confirm</DialogTitle>
          <DialogDescription className="text-butler-body">
            Review your items. Adjust quantities, names, or macros before I record them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Items:</Label>
            {editItems.map((item, index) => (
              <div key={index} className="space-y-2 rounded-lg border border-border/50 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor={`qty-${index}`} className="text-xs text-muted-foreground">Quantity</Label>
                    <Input id={`qty-${index}`} value={item.qty || ''} onChange={(e) => updateItem(index, 'qty', e.target.value)} placeholder="e.g., 2 slices, 150g" />
                  </div>
                  <div>
                    <Label htmlFor={`name-${index}`} className="text-xs text-muted-foreground">Food Item</Label>
                    <Input id={`name-${index}`} value={item.n || ''} onChange={(e) => updateItem(index, 'n', e.target.value)} placeholder="e.g., Whole grain toast" />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Cal</Label>
                    <Input type="number" inputMode="decimal" value={item.cal ?? ''} onChange={(e) => updateItem(index, 'cal', Number(e.target.value))} placeholder="160" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">P (g)</Label>
                    <Input type="number" inputMode="decimal" value={item.p ?? ''} onChange={(e) => updateItem(index, 'p', Number(e.target.value))} placeholder="8" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">C (g)</Label>
                    <Input type="number" inputMode="decimal" value={item.c ?? ''} onChange={(e) => updateItem(index, 'c', Number(e.target.value))} placeholder="30" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">F (g)</Label>
                    <Input type="number" inputMode="decimal" value={item.f ?? ''} onChange={(e) => updateItem(index, 'f', Number(e.target.value))} placeholder="2" />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Fib (g)</Label>
                    <Input type="number" inputMode="decimal" value={item.fib ?? ''} onChange={(e) => updateItem(index, 'fib', Number(e.target.value))} placeholder="6" />
                  </div>
                  {/* Render micronutrients present on any item */}
                  {micronutrientKeys.map((key) => (
                    <div key={key}>
                      <Label className="text-xs text-muted-foreground">{key}</Label>
                      <Input type="number" inputMode="decimal" value={(item[key] as number) ?? ''} onChange={(e) => updateItem(index, key, Number(e.target.value))} placeholder="0" />
                    </div>
                  ))}
                </div>

                {editItems.length > 1 && (
                  <div className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => removeFoodItem(index)} className="px-2 text-destructive hover:text-destructive">× Remove</Button>
                  </div>
                )}
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addFoodItem} className="w-full">
              <Edit3 className="w-4 h-4 mr-2" />
              Add Another Item
            </Button>
          </div>

          <Separator />

          <div className="sticky bottom-0 left-0 right-0 bg-card/95 supports-[backdrop-filter]:bg-card/80 backdrop-blur border-t border-border pt-2 pb-[env(safe-area-inset-bottom)]">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={onClose} disabled={loading} className="w-full sm:flex-1">
                Allow me to reconsider
              </Button>
              <Button onClick={handleConfirm} disabled={loading || editItems.some(it => !it.n?.trim())} className="w-full sm:flex-1 btn-butler">
                {loading ? (
                  <>
                    <div className="animate-spin w-4 h-4 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Confirm & Record
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmationModal;
