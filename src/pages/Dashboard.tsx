import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import * as Recharts from 'recharts';
import { Mic, Plus, History, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import RecordingModal from '@/components/RecordingModal';
import ConfirmationModal from '@/components/ConfirmationModal';
import MealCard from '@/components/MealCard';

// --- Type Definitions ---

interface DayData {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

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

// --- Dashboard Component ---

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // --- State Management ---
  const [dayData, setDayData] = useState<DayData>({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  const [meals, setMeals] = useState<Meal[]>([]);
  const [manualEntry, setManualEntry] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [analyzedItems, setAnalyzedItems] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Data Fetching ---
  const loadTodayData = async () => {
    if (!user) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: mealsData, error } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', user.id)
        .eq('logged_date', today)
        .order('logged_at', { ascending: false });

      if (error) throw error;

      setMeals(mealsData || []);
      
      const totals = mealsData?.reduce((acc, meal) => ({
        calories: acc.calories + (Number(meal.total_calories) || 0),
        protein: acc.protein + (Number(meal.protein) || 0),
        carbs: acc.carbs + (Number(meal.carbs) || 0),
        fat: acc.fat + (Number(meal.fat) || 0),
        fiber: acc.fiber + (Number(meal.fiber) || 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }) || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

      setDayData(totals);
    } catch (error) {
      console.error('Error loading today data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadTodayData();
    }
  }, [user]);

  // --- Event Handlers ---
  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'esteemed guest';
    
    if (hour < 12) return `Good morning, ${name}`;
    if (hour < 17) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
  };

  const handleRecordingComplete = (result: { items: any[] }) => {
    setAnalyzedItems(result.items || []);
    setIsRecording(false);
    setShowConfirmation(true);
  };

  const handleMealConfirmed = async () => {
    setShowConfirmation(false);
    setAnalyzedItems(null);
    await loadTodayData(); // Refresh data
    toast({
      title: "Meal recorded with distinction",
      description: "Your nutritional entry has been meticulously logged."
    });
  };

  const handleManualEntry = () => {
    if (manualEntry.trim()) {
      setAnalyzedItems([{ qty: '1 serving', n: manualEntry.trim() }]);
      setShowConfirmation(true);
      setManualEntry('');
    }
  };

  // --- Chart Data ---
  const pieData = [
    { name: 'Protein', value: Math.round(dayData.protein * 4), color: 'hsl(var(--chart-1))' },
    { name: 'Carbs', value: Math.round(dayData.carbs * 4), color: 'hsl(var(--chart-2))' },
    { name: 'Fat', value: Math.round(dayData.fat * 9), color: 'hsl(var(--chart-3))' }
  ].filter(item => item.value > 0);

  // --- Render Logic ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-butler-parchment">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Preparing your ledger...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-butler-parchment">
      {/* --- Header --- */}
      <header className="sticky top-0 z-10 border-b border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
          <div className="flex flex-col">
             <div className="flex items-baseline gap-x-2">
                <h1 className="text-butler-heading text-xl sm:text-2xl font-bold text-primary">Sir</h1>
                <h1 className="text-butler-heading text-xl sm:text-2xl font-bold text-primary">Dinewell</h1>
              </div>
            <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">{getGreeting()}</p>
          </div>
          <div className="flex gap-1 sm:gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/history')}>
              <History className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">The Ledger</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <User className="w-4 h-4 md:mr-2" />
               <span className="hidden md:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-8">
          
          {/* --- Macro Chart Card --- */}
          <Card className="card-butler hover-elevate">
            <CardHeader className="text-center">
              <CardTitle className="text-butler-heading">Today's Nutritional Summary</CardTitle>
              <CardDescription>
                {dayData.calories > 0 
                  ? `${Math.round(dayData.calories)} calories consumed with precision`
                  : "Your ledger awaits the first entry of the day"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <div className="h-56 sm:h-64">
                  <Recharts.ResponsiveContainer width="100%" height="100%">
                    <Recharts.PieChart>
                      <Recharts.Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius="80%"
                        innerRadius="50%"
                      >
                        {pieData.map((entry, index) => (
                          <Recharts.Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Recharts.Pie>
                      <Recharts.Tooltip formatter={(value: number) => [`${value} cal`, '']} />
                      <Recharts.Legend />
                    </Recharts.PieChart>
                  </Recharts.ResponsiveContainer>
                </div>
              ) : (
                <div className="h-56 sm:h-64 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <div className="w-16 h-16 border-2 border-dashed border-muted-foreground/30 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <Plus className="w-8 h-8" />
                    </div>
                    <p>No meals recorded yet today</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* --- Recording Card --- */}
          <Card className="card-butler">
            <CardHeader>
              <CardTitle className="text-butler-heading">Record Your Meal</CardTitle>
              <CardDescription>
                Please describe your culinary experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex flex-col justify-center h-full pb-6">
              <Button 
                onClick={() => setIsRecording(true)}
                className="w-full h-20 text-lg btn-butler hover-elevate"
              >
                <Mic className="w-6 h-6 mr-3" />
                Ready to Record
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or, if you prefer</span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="A written note, if you prefer..."
                  value={manualEntry}
                  onChange={(e) => setManualEntry(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleManualEntry()}
                  className="flex-1"
                />
                <Button onClick={handleManualEntry} disabled={!manualEntry.trim()} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- Today's Meals List --- */}
        {meals.length > 0 && (
          <div>
            <h2 className="text-butler-heading text-xl font-semibold mb-4">
              Today's Entries
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {meals.map((meal) => (
                <MealCard key={meal.id} meal={meal} />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* --- Modals --- */}
      <RecordingModal
        isOpen={isRecording}
        onClose={() => setIsRecording(false)}
        onRecordingComplete={handleRecordingComplete}
      />

      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        items={analyzedItems || []}
        onConfirm={handleMealConfirmed}
      />
    </div>
  );
};

export default Dashboard;
