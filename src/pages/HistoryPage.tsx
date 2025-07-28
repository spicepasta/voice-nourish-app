import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { ArrowLeft, Calendar as CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import MealCard from '@/components/MealCard';
import { format } from 'date-fns';

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

interface DaySummary {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealCount: number;
}

const HistoryPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [daySummaries, setDaySummaries] = useState<DaySummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMealsForDate = async (date: Date) => {
    if (!user) return;
    
    try {
      const dateStr = date.toISOString().split('T')[0];
      
      const { data: meals, error } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', user.id)
        .eq('logged_date', dateStr)
        .order('logged_at', { ascending: false });

      if (error) throw error;
      setMeals(meals || []);
    } catch (error) {
      console.error('Error loading meals:', error);
    }
  };

  const loadHistorySummary = async () => {
    if (!user) return;
    
    try {
      // Get last 30 days of data
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().split('T')[0];
      
      const { data: meals, error } = await supabase
        .from('meals')
        .select('logged_date, total_calories, protein, carbs, fat')
        .eq('user_id', user.id)
        .gte('logged_date', dateStr)
        .order('logged_date', { ascending: false });

      if (error) throw error;

      // Group by date and calculate summaries
      const summaryMap = new Map<string, DaySummary>();
      
      meals?.forEach(meal => {
        const date = meal.logged_date;
        if (!summaryMap.has(date)) {
          summaryMap.set(date, {
            date,
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            mealCount: 0
          });
        }
        
        const summary = summaryMap.get(date)!;
        summary.calories += Number(meal.total_calories) || 0;
        summary.protein += Number(meal.protein) || 0;
        summary.carbs += Number(meal.carbs) || 0;
        summary.fat += Number(meal.fat) || 0;
        summary.mealCount += 1;
      });
      
      setDaySummaries(Array.from(summaryMap.values()));
    } catch (error) {
      console.error('Error loading history summary:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        loadMealsForDate(selectedDate),
        loadHistorySummary()
      ]);
      setLoading(false);
    };
    
    loadData();
  }, [user, selectedDate]);

  const getDateSummary = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return daySummaries.find(summary => summary.date === dateStr);
  };

  const hasDataForDate = (date: Date) => {
    return !!getDateSummary(date);
  };

  const selectedDateSummary = getDateSummary(selectedDate);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-butler-parchment">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Retrieving your historical records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-butler-parchment">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/')} className="hover-elevate">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return to Dashboard
          </Button>
          <div>
            <h1 className="text-butler-heading text-2xl font-bold text-primary">The Ledger</h1>
            <p className="text-sm text-muted-foreground">Your meticulously maintained nutritional records</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar */}
          <div className="lg:col-span-1">
            <Card className="card-butler">
              <CardHeader>
                <CardTitle className="text-butler-heading flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  Select Date
                </CardTitle>
                <CardDescription>
                  Choose a date to review your entries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="rounded-md border-0"
                  modifiers={{
                    hasData: (date) => hasDataForDate(date)
                  }}
                  modifiersStyles={{
                    hasData: { 
                      backgroundColor: 'hsl(var(--primary) / 0.1)',
                      color: 'hsl(var(--primary))',
                      fontWeight: 'bold'
                    }
                  }}
                />
                <div className="mt-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-primary/20"></div>
                    <span>Days with recorded meals</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Selected Date Details */}
          <div className="lg:col-span-2">
            <div className="space-y-6">
              {/* Date Summary */}
              <Card className="card-butler">
                <CardHeader>
                  <CardTitle className="text-butler-heading">
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  </CardTitle>
                  <CardDescription>
                    {selectedDateSummary 
                      ? `${selectedDateSummary.mealCount} meal${selectedDateSummary.mealCount !== 1 ? 's' : ''} recorded`
                      : "No entries recorded for this date"
                    }
                  </CardDescription>
                </CardHeader>
                {selectedDateSummary && (
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-primary/5 rounded-lg">
                        <div className="text-2xl font-bold text-primary">
                          {Math.round(selectedDateSummary.calories)}
                        </div>
                        <div className="text-xs text-muted-foreground">Calories</div>
                      </div>
                      <div className="text-center p-3 bg-chart-1/10 rounded-lg">
                        <div className="text-2xl font-bold text-chart-1">
                          {Math.round(selectedDateSummary.protein)}g
                        </div>
                        <div className="text-xs text-muted-foreground">Protein</div>
                      </div>
                      <div className="text-center p-3 bg-chart-2/10 rounded-lg">
                        <div className="text-2xl font-bold text-chart-2">
                          {Math.round(selectedDateSummary.carbs)}g
                        </div>
                        <div className="text-xs text-muted-foreground">Carbs</div>
                      </div>
                      <div className="text-center p-3 bg-chart-3/10 rounded-lg">
                        <div className="text-2xl font-bold text-chart-3">
                          {Math.round(selectedDateSummary.fat)}g
                        </div>
                        <div className="text-xs text-muted-foreground">Fat</div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Meals for Selected Date */}
              {meals.length > 0 ? (
                <div>
                  <h2 className="text-butler-heading text-xl font-semibold mb-4">
                    Recorded Meals
                  </h2>
                  <div className="grid grid-cols-1 gap-4">
                    {meals.map((meal) => (
                      <MealCard key={meal.id} meal={meal} />
                    ))}
                  </div>
                </div>
              ) : selectedDateSummary ? (
                <Card className="card-butler">
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground">
                      No detailed meal records found for this date.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="card-butler">
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground">
                      No meals were recorded on this date.
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Perhaps consider logging your next meal?
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HistoryPage;