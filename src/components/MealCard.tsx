import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Clock, Zap } from 'lucide-react';

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

interface MealCardProps {
  meal: Meal;
}

const MealCard = ({ meal }: MealCardProps) => {
  const [showMicros, setShowMicros] = useState(false);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMicronutrients = () => {
    if (!meal.micronutrients || Object.keys(meal.micronutrients).length === 0) {
      return <p className="text-muted-foreground text-sm">No micronutrient data available</p>;
    }

    return (
      <div className="grid grid-cols-2 gap-2 text-sm">
        {Object.entries(meal.micronutrients).map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <span className="capitalize text-muted-foreground">
              {key.replace(/_/g, ' ')}:
            </span>
            <span className="font-medium">
              {typeof value === 'number' ? `${value}${getUnit(key)}` : String(value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const getUnit = (nutrient: string) => {
    const mgNutrients = ['vitamin_c', 'vitamin_e', 'calcium', 'iron', 'magnesium'];
    const mcgNutrients = ['folate', 'vitamin_b12', 'vitamin_d'];
    
    if (mgNutrients.includes(nutrient)) return 'mg';
    if (mcgNutrients.includes(nutrient)) return 'µg';
    if (nutrient === 'potassium') return 'mg';
    return '';
  };

  return (
    <Card className="card-butler hover-elevate">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-butler-heading text-lg leading-tight">
              {meal.meal_name}
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-3 h-3" />
                {formatTime(meal.logged_at)}
              </div>
            </CardDescription>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
            <Zap className="w-3 h-3 mr-1" />
            {Math.round(meal.total_calories || 0)} cal
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Macros Summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-chart-1/10 rounded-lg p-2">
            <div className="text-sm font-medium text-chart-1">
              {Math.round(meal.protein || 0)}g
            </div>
            <div className="text-xs text-muted-foreground">Protein</div>
          </div>
          <div className="bg-chart-2/10 rounded-lg p-2">
            <div className="text-sm font-medium text-chart-2">
              {Math.round(meal.carbs || 0)}g
            </div>
            <div className="text-xs text-muted-foreground">Carbs</div>
          </div>
          <div className="bg-chart-3/10 rounded-lg p-2">
            <div className="text-sm font-medium text-chart-3">
              {Math.round(meal.fat || 0)}g
            </div>
            <div className="text-xs text-muted-foreground">Fat</div>
          </div>
        </div>

        {meal.fiber && meal.fiber > 0 && (
          <div className="text-center">
            <Badge variant="outline" className="text-xs">
              {Math.round(meal.fiber)}g fiber
            </Badge>
          </div>
        )}

        {/* Micronutrients Collapsible */}
        <Collapsible open={showMicros} onOpenChange={setShowMicros}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-sm p-2 h-auto">
              Review Micronutrients
              <ChevronDown className={`w-4 h-4 transition-transform ${showMicros ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="bg-muted/30 rounded-lg p-3">
              {renderMicronutrients()}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Description */}
        {meal.description && (
          <div className="bg-muted/20 rounded-lg p-2">
            <p className="text-xs text-muted-foreground italic">
              "{meal.description}"
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MealCard;