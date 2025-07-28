import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Check, Edit3 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface FoodItem {
  name: string;
  quantity: string;
}

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  transcribedText: string;
  onConfirm: (mealData: any) => void;
}

const ConfirmationModal = ({ isOpen, onClose, transcribedText, onConfirm }: ConfirmationModalProps) => {
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Parse the transcribed text into food items when modal opens
  useState(() => {
    if (transcribedText && isOpen) {
      // Simple parsing - in production, this would be more sophisticated
      const items = parseFoodItems(transcribedText);
      setFoodItems(items);
      setAnalyzed(false);
    }
  });

  const parseFoodItems = (text: string): FoodItem[] => {
    // Simple parsing logic - could be enhanced with AI
    const cleanText = text.toLowerCase();
    
    // Try to identify common patterns
    if (cleanText.includes('toast') && cleanText.includes('avocado')) {
      return [
        { name: 'Whole grain toast', quantity: '2 slices' },
        { name: 'Avocado', quantity: '1 medium' },
        { name: 'Scrambled egg', quantity: '1 large' }
      ];
    }
    
    // Default fallback
    return [{ name: text, quantity: '1 serving' }];
  };

  const updateFoodItem = (index: number, field: keyof FoodItem, value: string) => {
    const updated = [...foodItems];
    updated[index] = { ...updated[index], [field]: value };
    setFoodItems(updated);
  };

  const handleConfirm = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      // TODO: Call OpenAI edge function for nutritional analysis
      // For now, use mock data
      const mockNutrition = {
        meal_name: foodItems.map(item => `${item.quantity} ${item.name}`).join(', '),
        description: transcribedText,
        total_calories: 420,
        protein: 18,
        carbs: 35,
        fat: 22,
        fiber: 12,
        micronutrients: {
          vitamin_c: 15,
          vitamin_e: 8,
          folate: 60,
          potassium: 450,
          magnesium: 85,
          iron: 3.2
        }
      };

      const { error } = await supabase
        .from('meals')
        .insert({
          user_id: user.id,
          ...mockNutrition
        });

      if (error) throw error;

      onConfirm(mockNutrition);
    } catch (error) {
      console.error('Error saving meal:', error);
      toast({
        variant: "destructive",
        title: "Recording Error",
        description: "Unable to save your meal. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const addFoodItem = () => {
    setFoodItems([...foodItems, { name: '', quantity: '1 serving' }]);
  };

  const removeFoodItem = (index: number) => {
    const updated = foodItems.filter((_, i) => i !== index);
    setFoodItems(updated);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-butler-heading">
            If I May Confirm
          </DialogTitle>
          <DialogDescription className="text-butler-body">
            I've understood your meal to be as follows. Are any corrections needed?
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-muted/30 p-3 rounded-lg">
            <Label className="text-sm font-medium text-muted-foreground">Original Description:</Label>
            <p className="text-sm mt-1 italic">"{transcribedText}"</p>
          </div>
          
          <Separator />
          
          <div className="space-y-3">
            <Label className="text-sm font-medium">Parsed Items:</Label>
            {foodItems.map((item, index) => (
              <div key={index} className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor={`item-${index}`} className="text-xs text-muted-foreground">
                    Food Item
                  </Label>
                  <Input
                    id={`item-${index}`}
                    value={item.name}
                    onChange={(e) => updateFoodItem(index, 'name', e.target.value)}
                    placeholder="Food item"
                  />
                </div>
                <div>
                  <Label htmlFor={`quantity-${index}`} className="text-xs text-muted-foreground">
                    Quantity
                  </Label>
                  <div className="flex gap-1">
                    <Input
                      id={`quantity-${index}`}
                      value={item.quantity}
                      onChange={(e) => updateFoodItem(index, 'quantity', e.target.value)}
                      placeholder="Quantity"
                    />
                    {foodItems.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFoodItem(index)}
                        className="px-2 text-destructive hover:text-destructive"
                      >
                        ×
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            <Button
              variant="outline"
              size="sm"
              onClick={addFoodItem}
              className="w-full"
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Add Another Item
            </Button>
          </div>
          
          <Separator />
          
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
              Allow me to reconsider
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={loading || foodItems.some(item => !item.name.trim())}
              className="flex-1 btn-butler"
            >
              {loading ? (
                <>
                  <div className="animate-spin w-4 h-4 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full"></div>
                  Analyzing...
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
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmationModal;