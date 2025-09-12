import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, Edit3, Info, RefreshCw } from 'lucide-react';
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

export interface AssumptionItem {
  type: string;
  description: string;
}

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: TokenItem[]; // Items from edge function
  assumptions?: AssumptionItem[]; // AI assumptions
  detectedTime?: string | null; // AI-detected time from the meal description
  onConfirm: (payload: { items: TokenItem[]; totals?: any; loggedAt?: string }) => void;
  editMode?: boolean; // For editing existing meals
  mealId?: string; // For updating existing meals
}

const KNOWN_KEYS = new Set(["qty", "n", "cal", "p", "c", "f", "fib"]);

const ConfirmationModal = ({ isOpen, onClose, items, assumptions = [], detectedTime, onConfirm, editMode = false, mealId }: ConfirmationModalProps) => {
  const [editItems, setEditItems] = useState<TokenItem[]>([]);
  const [baseValues, setBaseValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [loggedAt, setLoggedAt] = useState<string>('');
  const { user } = useAuth();
  const { toast } = useToast();

  // Helper function to parse quantity number from string like "2 slices" -> 2
  const parseQuantityNumber = (qtyString: string): number => {
    const match = qtyString.match(/^(\d*\.?\d+)/);
    return match ? parseFloat(match[1]) : 1;
  };

  // Helper function to get quantity unit from string like "2 slices" -> "slices"
  const getQuantityUnit = (qtyString: string): string => {
    return qtyString.replace(/^(\d*\.?\d+)\s*/, '').trim() || 'serving';
  };

  // Initialize local editable items and calculate base values whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const initialItems = Array.isArray(items) && items.length ? items.map(i => ({ ...i })) : [{ qty: '1 serving', n: '' }];
      setEditItems(initialItems);
      
      // Calculate base per-unit values
      const bases: Record<string, any> = {};
      initialItems.forEach((item, index) => {
        const qtyNumber = parseQuantityNumber(item.qty || '1');
        const qtyUnit = getQuantityUnit(item.qty || '1 serving');
        
        bases[index] = {
          qtyNumber,
          qtyUnit,
          cal: (item.cal || 0) / qtyNumber,
          p: (item.p || 0) / qtyNumber,
          c: (item.c || 0) / qtyNumber,
          f: (item.f || 0) / qtyNumber,
          fib: (item.fib || 0) / qtyNumber,
        };
        
        // Handle micronutrients
        Object.keys(item).forEach(key => {
          if (!KNOWN_KEYS.has(key) && typeof item[key] === 'number') {
            bases[index][key] = (item[key] as number) / qtyNumber;
          }
        });
      });
      
      setBaseValues(bases);
    }
  }, [isOpen, items]);

  // Function to update quantity and recalculate nutrients
  const updateQuantity = (index: number, newQtyNumber: number) => {
    const base = baseValues[index];
    if (!base) return;
    
    const updated = [...editItems];
    const newQty = `${newQtyNumber} ${base.qtyUnit}`;
    
    updated[index] = {
      ...updated[index],
      qty: newQty,
      cal: Math.round((base.cal * newQtyNumber) * 100) / 100,
      p: Math.round((base.p * newQtyNumber) * 100) / 100,
      c: Math.round((base.c * newQtyNumber) * 100) / 100,
      f: Math.round((base.f * newQtyNumber) * 100) / 100,
      fib: Math.round((base.fib * newQtyNumber) * 100) / 100,
    };
    
    // Update micronutrients
    Object.keys(base).forEach(key => {
      if (!KNOWN_KEYS.has(key) && key !== 'qtyNumber' && key !== 'qtyUnit' && typeof base[key] === 'number') {
        updated[index][key] = Math.round((base[key] * newQtyNumber) * 100) / 100;
      }
    });
    
    setEditItems(updated);
  };

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
    const newIndex = editItems.length;
    const newItem = { qty: '1 serving', n: '' };
    setEditItems([...editItems, newItem]);
    
    // Add base values for the new item
    setBaseValues(prev => ({
      ...prev,
      [newIndex]: {
        qtyNumber: 1,
        qtyUnit: 'serving',
        cal: 0,
        p: 0,
        c: 0,
        f: 0,
        fib: 0,
      }
    }));
  };

  const removeFoodItem = (index: number) => {
    const newItems = editItems.filter((_, i) => i !== index);
    setEditItems(newItems);
    
    // Clean up base values and reindex them
    const newBaseValues: Record<string, any> = {};
    Object.keys(baseValues).forEach((key, i) => {
      const keyIndex = parseInt(key);
      if (keyIndex < index) {
        newBaseValues[keyIndex] = baseValues[key];
      } else if (keyIndex > index) {
        newBaseValues[keyIndex - 1] = baseValues[key];
      }
    });
    setBaseValues(newBaseValues);
  };

  const reanalyzeItems = async () => {
    if (!editItems.length) return;
    
    setReanalyzing(true);
    try {
      // Create text description from current items
      const textDescription = editItems.map(item => `${item.qty} ${item.n}`).join(', ');
      
      const { data: result, error } = await supabase.functions.invoke('analyze', {
        body: { text: textDescription },
      });

      if (error) {
        console.error('Analysis error:', error);
        toast({ variant: 'destructive', title: 'Analysis Error', description: 'Failed to analyze meal. Please try again.' });
        return;
      }

      if (result?.items && result.items.length > 0) {
        // Update nutritional values while preserving user-edited quantities and names
        const updatedItems = editItems.map((currentItem, index) => {
          const aiItem = result.items[index];
          if (aiItem) {
            return {
              ...currentItem,
              // Keep user's quantity and name, update nutritional values
              cal: aiItem.cal || currentItem.cal,
              p: aiItem.p || currentItem.p,
              c: aiItem.c || currentItem.c,
              f: aiItem.f || currentItem.f,
              fib: aiItem.fib || currentItem.fib,
              // Update micronutrients
              ...Object.keys(aiItem).reduce((acc, key) => {
                if (!KNOWN_KEYS.has(key) && typeof aiItem[key] === 'number') {
                  acc[key] = aiItem[key];
                }
                return acc;
              }, {} as Record<string, number>)
            };
          }
          return currentItem;
        });
        
        setEditItems(updatedItems);
        toast({ title: 'Success', description: 'Nutritional values updated based on current items.' });
      }
    } catch (error) {
      console.error('Error reanalyzing items:', error);
      toast({ variant: 'destructive', title: 'Analysis Error', description: 'Failed to analyze meal. Please try again.' });
    } finally {
      setReanalyzing(false);
    }
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

      // Persist to Supabase
      if (editMode && mealId) {
        // Update existing meal
        const { error } = await supabase
          .from('meals')
          .update({
            meal_name,
            description,
            total_calories: totals.total_calories,
            protein: totals.protein,
            carbs: totals.carbs,
            fat: totals.fat,
            fiber: totals.fiber,
            micronutrients: totals.micronutrients,
          })
          .eq('id', mealId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Insert new meal
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
        if (error) throw error;
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
          <DialogTitle className="text-butler-heading">
            {editMode ? "If I May Assist with Revisions" : "If I May Confirm"}
          </DialogTitle>
          <DialogDescription className="text-butler-body">
            {editMode 
              ? "Modify your meal details as desired."
              : "Review your items. Adjust quantities, names, or macros before I record them."
            }
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
                    <div className="flex items-center gap-1">
                      <Input 
                        id={`qty-${index}`} 
                        type="number" 
                        step="0.1"
                        min="0.1"
                        value={baseValues[index]?.qtyNumber || parseQuantityNumber(item.qty || '1')} 
                        onChange={(e) => updateQuantity(index, parseFloat(e.target.value) || 0.1)} 
                        placeholder="1" 
                        className="flex-1"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {baseValues[index]?.qtyUnit || getQuantityUnit(item.qty || '1 serving')}
                      </span>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`name-${index}`} className="text-xs text-muted-foreground">Food Item</Label>
                    <Input id={`name-${index}`} value={item.n || ''} onChange={(e) => updateItem(index, 'n', e.target.value)} placeholder="e.g., Whole grain toast" />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Cal</Label>
                    <Input 
                      type="number" 
                      inputMode="decimal" 
                      value={item.cal ?? ''} 
                      placeholder="160" 
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">P (g)</Label>
                    <Input 
                      type="number" 
                      inputMode="decimal" 
                      value={item.p ?? ''} 
                      placeholder="8" 
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">C (g)</Label>
                    <Input 
                      type="number" 
                      inputMode="decimal" 
                      value={item.c ?? ''} 
                      placeholder="30" 
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">F (g)</Label>
                    <Input 
                      type="number" 
                      inputMode="decimal" 
                      value={item.f ?? ''} 
                      placeholder="2" 
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Fib (g)</Label>
                    <Input 
                      type="number" 
                      inputMode="decimal" 
                      value={item.fib ?? ''} 
                      placeholder="6" 
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  {/* Render micronutrients present on any item */}
                  {micronutrientKeys.map((key) => (
                    <div key={key}>
                      <Label className="text-xs text-muted-foreground">{key}</Label>
                      <Input 
                        type="number" 
                        inputMode="decimal" 
                        value={(item[key] as number) ?? ''} 
                        placeholder="0" 
                        disabled
                        className="bg-muted"
                      />
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

          {/* Assumptions Section */}
          {assumptions.length > 0 && (
            <>
              <Separator />
              <div className="flex justify-center">
                <Popover open={showAssumptions} onOpenChange={setShowAssumptions}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full max-w-xs">
                      <Info className="w-4 h-4 mr-2" />
                      Quantity Estimates
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 max-h-[50vh] sm:max-h-60 overflow-y-auto z-50 bg-popover">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-butler-heading">AI Assumptions</h4>
                      <div className="text-xs text-muted-foreground">
                        The following estimates were made:
                      </div>
                      <div className="space-y-2 max-h-[40vh] sm:max-h-48 overflow-y-auto">
                        {assumptions.map((assumption, index) => (
                          <div key={index} className="border-l-2 border-primary/20 pl-3 py-1">
                            <div className="text-xs font-medium text-primary">{assumption.type}</div>
                            <div className="text-xs text-muted-foreground">{assumption.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}

          <Separator />

          <div className="sticky bottom-0 left-0 right-0 bg-card/95 supports-[backdrop-filter]:bg-card/80 backdrop-blur border-t border-border pt-2 pb-[env(safe-area-inset-bottom)]">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={onClose} disabled={loading} className="w-full sm:flex-1">
                  Allow me to reconsider
                </Button>
                {editMode && (
                  <Button 
                    variant="secondary" 
                    onClick={reanalyzeItems} 
                    disabled={loading || reanalyzing}
                    className="w-full sm:flex-1 flex items-center gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${reanalyzing ? 'animate-spin' : ''}`} />
                    {reanalyzing ? 'Reanalyzing...' : 'Update Nutrients'}
                  </Button>
                )}
                <Button onClick={handleConfirm} disabled={loading || editItems.some(it => !it.n?.trim())} className="w-full sm:flex-1 btn-butler">
                  {loading ? (
                    <>
                      <div className="animate-spin w-4 h-4 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full"></div>
                      {editMode ? "Updating..." : "Saving..."}
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      {editMode ? "Update Meal" : "Confirm & Record"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmationModal;
