import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Edit3, Trash2, Clock, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Meal {
  id: string;
  meal_name: string;
  description: string;
  total_calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  micronutrients: any;
  logged_at: string;
}

interface ViewMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  meal: Meal | null;
  onEdit: (meal: Meal) => void;
  onMealDeleted: () => void;
}

const ViewMealModal = ({ isOpen, onClose, meal, onEdit, onMealDeleted }: ViewMealModalProps) => {
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  if (!meal) return null;

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString([], { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const renderMicronutrients = () => {
    if (!meal.micronutrients || Object.keys(meal.micronutrients).length === 0) {
      return <p className="text-muted-foreground text-sm">No micronutrient data available</p>;
    }

    return (
      <div className="grid grid-cols-2 gap-2 text-sm">
        {Object.entries(meal.micronutrients).map(([key, value]) => {
          const parts = key.split('_');
          const nutrientName = parts[0];
          const unit = parts[1];
          const formattedLabel = unit ? `${nutrientName} (${unit})` : nutrientName;

          return (
            <div key={key} className="flex justify-between">
              <span className="capitalize text-muted-foreground">
                {formattedLabel}:
              </span>
              <span className="font-medium">
                {String(value)}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('meals')
        .delete()
        .eq('id', meal.id);

      if (error) throw error;

      toast({
        title: "Meal deleted",
        description: "The entry has been removed from your records."
      });

      onMealDeleted();
      onClose();
    } catch (error) {
      console.error('Error deleting meal:', error);
      toast({
        variant: "destructive",
        title: "Deletion failed",
        description: "Unable to delete the meal. Please try again."
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleEditClick = () => {
    onEdit(meal);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[92vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-butler-heading text-lg flex items-start justify-between">
            <span className="flex-1 pr-2">{meal.meal_name}</span>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              <Zap className="w-3 h-3 mr-1" />
              {Math.round(meal.total_calories || 0)} cal
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-3 h-3" />
              {formatTime(meal.logged_at)} • {formatDate(meal.logged_at)}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Macros Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-chart-1/10 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-chart-1">
                {Math.round(meal.protein || 0)}g
              </div>
              <div className="text-xs text-muted-foreground">Protein</div>
            </div>
            <div className="bg-chart-2/10 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-chart-2">
                {Math.round(meal.carbs || 0)}g
              </div>
              <div className="text-xs text-muted-foreground">Carbs</div>
            </div>
            <div className="bg-chart-3/10 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-chart-3">
                {Math.round(meal.fat || 0)}g
              </div>
              <div className="text-xs text-muted-foreground">Fat</div>
            </div>
          </div>

          {meal.fiber && meal.fiber > 0 && (
            <div className="text-center">
              <Badge variant="outline" className="text-sm px-3 py-1">
                {Math.round(meal.fiber)}g fiber
              </Badge>
            </div>
          )}

          <Separator />

          {/* Micronutrients */}
          <div>
            <h4 className="text-sm font-medium mb-3">Micronutrients</h4>
            <div className="bg-muted/30 rounded-lg p-3">
              {renderMicronutrients()}
            </div>
          </div>

          {/* Description */}
          {meal.description && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Items</h4>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground italic">
                    "{meal.description}"
                  </p>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              onClick={handleEditClick}
              className="flex-1"
              variant="outline"
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Edit Meal
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="px-3 border-destructive/20 text-destructive hover:bg-destructive/10"
                  disabled={deleting}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Meal Entry</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you certain you wish to remove "{meal.meal_name}" from your records? 
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Entry
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ViewMealModal;