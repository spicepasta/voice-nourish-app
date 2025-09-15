import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, Check, Info, Mic, Loader2, Bot, Trash2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { generateMealName, getTimeOfDay, getTimeRangeForPeriod } from '@/utils/mealNaming';
import RecordingModal from './RecordingModal';

// --- Type Definitions ---
export interface TokenItem {
  qty: string;
  n: string;
  cal?: number;
  p?: number;
  c?: number;
  f?: number;
  fib?: number;
  [key: string]: string | number | undefined;
}

export interface AssumptionItem {
  type: string;
  description: string;
}

interface AnalyzedResult {
  items: TokenItem[];
  assumptions?: AssumptionItem[];
  meal_title?: string;
}

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: TokenItem[];
  assumptions?: AssumptionItem[];
  detectedTime?: string | null;
  onConfirm: () => void;
  editMode?: boolean;
  mealId?: string;
}

const KNOWN_KEYS = new Set(["qty", "n", "cal", "p", "c", "f", "fib"]);

const ConfirmationModal = ({ isOpen, onClose, items, assumptions = [], detectedTime, onConfirm, editMode = false, mealId }: ConfirmationModalProps) => {
  const [editItems, setEditItems] = useState<TokenItem[]>([]);
  const [baseValues, setBaseValues] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(false);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [selectedMealDate, setSelectedMealDate] = useState<Date>(new Date());
  const [selectedTimeOfDay, setSelectedTimeOfDay] = useState<string>('');
  
  const [newItemText, setNewItemText] = useState('');
  const [isAnalyzingNewItem, setIsAnalyzingNewItem] = useState(false);
  const [isRecordingNewItem, setIsRecordingNewItem] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();

  const parseQuantityNumber = (qtyString: string): number => {
    const match = String(qtyString).match(/^(\d*\.?\d+)/);
    return match ? parseFloat(match[1]) : 1;
  };

  const getQuantityUnit = (qtyString: string): string => {
    return String(qtyString).replace(/^(\d*\.?\d+)\s*/, '').trim();
  };
  
  const calculateBaseValues = (itemsToIndex: TokenItem[]) => {
      const bases: Record<number, any> = {};
      itemsToIndex.forEach((item, index) => {
        const qtyNumber = parseQuantityNumber(item.qty || '1');
        const divisor = qtyNumber === 0 ? 1 : qtyNumber;
        bases[index] = {
          qtyUnit: getQuantityUnit(item.qty || '1 serving'),
          cal: (item.cal || 0) / divisor,
          p: (item.p || 0) / divisor,
          c: (item.c || 0) / divisor,
          f: (item.f || 0) / divisor,
          fib: (item.fib || 0) / divisor,
        };
        Object.keys(item).forEach(key => {
          if (!KNOWN_KEYS.has(key) && typeof item[key] === 'number') {
            bases[index][key] = (item[key] as number) / divisor;
          }
        });
      });
      return bases;
  }

  useEffect(() => {
    if (isOpen) {
      const initialItems = Array.isArray(items) && items.length > 0 ? items.map(i => ({ ...i })) : [];
      setEditItems(initialItems);
      
      const targetDate = detectedTime ? new Date(detectedTime) : new Date();
      setSelectedMealDate(targetDate);
      setSelectedTimeOfDay(getTimeOfDay(targetDate));
      
      setBaseValues(calculateBaseValues(initialItems));
      setNewItemText('');
    }
  }, [isOpen, items, detectedTime]);

  const handleAddNewItems = (newlyAnalyzed: AnalyzedResult) => {
    if (newlyAnalyzed?.items?.length > 0) {
        // --- THE FIX: Use the functional update form to avoid stale state ---
        setEditItems(prevItems => {
            const combinedItems = [...prevItems, ...newlyAnalyzed.items];
            // Also update base values right after updating items
            setBaseValues(calculateBaseValues(combinedItems));
            return combinedItems;
        });
        toast({ title: "Item(s) Added", description: "The new items have been added to your meal." });
    }
    setNewItemText('');
    setIsRecordingNewItem(false);
  };

  const handleAddItemByText = async () => {
    if (!newItemText.trim()) return;
    setIsAnalyzingNewItem(true);
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Authentication required.");

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ text: newItemText }),
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.details || 'Failed to analyze item.');
        
        handleAddNewItems(result);

    } catch (error: any) {
        toast({ variant: "destructive", title: "Analysis Failed", description: error.message });
    } finally {
        setIsAnalyzingNewItem(false);
    }
  };

  const updateQuantity = (index: number, newQtyNumber: number) => {
    if (isNaN(newQtyNumber) || newQtyNumber < 0) return;

    const base = baseValues[index];
    if (!base) return;

    const updated = [...editItems];
    const currentItem = { ...updated[index] };
    
    currentItem.qty = `${newQtyNumber} ${base.qtyUnit}`;
    currentItem.cal = parseFloat((base.cal * newQtyNumber).toFixed(2));
    currentItem.p = parseFloat((base.p * newQtyNumber).toFixed(2));
    currentItem.c = parseFloat((base.c * newQtyNumber).toFixed(2));
    currentItem.f = parseFloat((base.f * newQtyNumber).toFixed(2));
    currentItem.fib = parseFloat((base.fib * newQtyNumber).toFixed(2));

    Object.keys(base).forEach(key => {
      if (!KNOWN_KEYS.has(key) && key !== 'qtyUnit') {
        (currentItem as any)[key] = parseFloat((base[key] * newQtyNumber).toFixed(2));
      }
    });

    updated[index] = currentItem;
    setEditItems(updated);
  };
  
  const removeFoodItem = (index: number) => {
    const newItems = editItems.filter((_, i) => i !== index);
    setEditItems(newItems);
    setBaseValues(calculateBaseValues(newItems));
  };

  const computeTotals = (list: TokenItem[]) => {
    return list.reduce(
      (acc, it) => {
        acc.total_calories += Number(it.cal || 0);
        acc.protein += Number(it.p || 0);
        acc.carbs += Number(it.c || 0);
        acc.fat += Number(it.f || 0);
        acc.fiber += Number(it.fib || 0);
        for (const [k, v] of Object.entries(it)) {
          if (!KNOWN_KEYS.has(k) && typeof v === 'number') {
            (acc.micronutrients as any)[k] = ((acc.micronutrients as any)[k] || 0) + v;
          }
        }
        return acc;
      },
      { total_calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, micronutrients: {} }
    );
  };
  
  const handleConfirm = async () => {
    if (!user) return;
    setLoading(true);
    try {
        const totals = computeTotals(editItems);
        const meal_name = generateMealName(editItems);
        const description = editItems.map(i => `${i.qty} ${i.n}`.trim()).join(', ');

        const finalDate = new Date(selectedMealDate);
        const timeRange = getTimeRangeForPeriod(selectedTimeOfDay);
        finalDate.setHours(timeRange.start, Math.floor(Math.random() * 60), 0, 0);

        const mealData = {
            meal_name,
            description,
            total_calories: totals.total_calories,
            protein: totals.protein,
            carbs: totals.carbs,
            fat: totals.fat,
            fiber: totals.fiber,
            micronutrients: totals.micronutrients,
            logged_at: finalDate.toISOString(),
            logged_date: finalDate.toISOString().split('T')[0],
        };

        if (editMode && mealId) {
            const { error } = await supabase.from('meals').update(mealData).eq('id', mealId);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('meals').insert({ ...mealData, user_id: user.id });
            if (error) throw error;
        }
        onConfirm();
    } catch (error) {
        console.error('Error saving meal:', error);
        toast({ variant: 'destructive', title: 'Recording Error', description: 'Unable to save your meal.' });
    } finally {
        setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-sm w-[92vw] sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-butler-heading">
              {editMode ? "If I May Assist with Revisions" : "Your Meal Summary"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Items:</Label>
              {editItems.length > 0 ? (
                editItems.map((item, index) => (
                  <div key={index} className="space-y-3 rounded-lg border border-border/50 p-3 relative">
                     <div className="grid grid-cols-[1fr,2fr] gap-3 items-start">
                        <div>
                            <Label htmlFor={`qty-${index}`} className="text-xs text-muted-foreground">Quantity</Label>
                            <div className="flex items-center gap-2">
                            <Input
                                id={`qty-${index}`}
                                type="number"
                                step="0.01"
                                min="0"
                                value={parseQuantityNumber(item.qty)}
                                onChange={(e) => updateQuantity(index, parseFloat(e.target.value))}
                                className="flex-1 h-9"
                            />
                            <span className="text-sm text-muted-foreground whitespace-nowrap">{baseValues[index]?.qtyUnit}</span>
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground">Food Item</Label>
                            <p className="text-sm font-medium p-2 bg-muted/50 rounded-md min-h-[36px] whitespace-normal break-words">
                                {item.n || 'N/A'}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                      {['cal', 'p', 'c', 'f', 'fib'].map(nutrient => (
                        <div key={nutrient}>
                          <Label className="text-xs text-muted-foreground capitalize">{nutrient}</Label>
                          <Input value={(item as any)[nutrient] ?? ''} disabled className="bg-muted/50 h-8 text-xs" />
                        </div>
                      ))}
                    </div>
                    
                    <Button variant="ghost" size="icon" onClick={() => removeFoodItem(index)} className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-muted-foreground py-4 border-2 border-dashed rounded-lg">
                  No items added yet. Use the section below to add your first item.
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2">
                <div className="relative">
                    <Bot className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="e.g., 'A bowl of oats with blueberries and a black coffee...'"
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddItemByText()}
                        disabled={isAnalyzingNewItem}
                        className="pl-10 h-12 text-base"
                    />
                    <Button 
                        size="icon" 
                        onClick={() => setIsRecordingNewItem(true)} 
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 bg-primary/90 hover:bg-primary rounded-full"
                    >
                        {isAnalyzingNewItem ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
                    </Button>
                </div>
            </div>
            
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2"><CalendarIcon className="w-4 h-4" /> Meal Date & Time</Label>
              <div className="grid grid-cols-2 gap-2">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="font-normal justify-start">
                           <span>{format(selectedMealDate, 'PPP')}</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={selectedMealDate} onSelect={(date) => date && setSelectedMealDate(date)} initialFocus />
                    </PopoverContent>
                </Popover>
                <Select value={selectedTimeOfDay} onValueChange={setSelectedTimeOfDay}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="morning">Morning</SelectItem>
                        <SelectItem value="noon">Noon</SelectItem>
                        <SelectItem value="afternoon">Afternoon</SelectItem>
                        <SelectItem value="evening">Evening</SelectItem>
                        <SelectItem value="night">Night</SelectItem>
                    </SelectContent>
                </Select>
              </div>
           </div>

          {assumptions.length > 0 && (
            <>
              <Separator />
              <div className="flex justify-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-muted-foreground">
                      <Info className="w-4 h-4 mr-2" /> View AI Assumptions
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 max-h-[50vh] overflow-y-auto">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">AI Assumptions</h4>
                      {assumptions.map((assumption, index) => (
                        <div key={index} className="text-xs p-2 bg-muted/50 rounded">
                           <strong className="text-primary">{assumption.type}:</strong> {assumption.description}
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}

          <Separator />

          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading} className="w-full">Cancel</Button>
            <Button onClick={handleConfirm} disabled={loading || editItems.length === 0} className="w-full btn-butler">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              {editMode ? "Update Meal" : "Confirm & Record"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <RecordingModal
      isOpen={isRecordingNewItem}
      onClose={() => setIsRecordingNewItem(false)}
      onRecordingComplete={handleAddNewItems}
    />
  </>
  );
};

export default ConfirmationModal;
