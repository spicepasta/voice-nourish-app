import { useState, useEffect } from 'react';
import { useAuth, useEmailVerification } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from "@/components/ui/alert";
import * as Recharts from 'recharts';
import { Mic, Plus, History, User, Bot, Loader2, TrendingUp, RefreshCw, AlertCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import RecordingModal from '@/components/RecordingModal';
import ConfirmationModal from '@/components/ConfirmationModal';
import MealCard from '@/components/MealCard';
import HealthProfileModal from '@/components/HealthProfileModal';
import NotificationCenter from '@/components/NotificationCenter';

// --- Type Definitions ---
interface Assumption {
  type: string;
  description: string;
}

interface AnalyzedResult {
  items: any[];
  assumptions?: Assumption[];
  detected_time?: string | null;
}

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

interface UserProfile {
  id: string;
  user_id: string;
  display_name?: string;
  height_cm?: number;
  weight_kg?: number;
  gender?: string;
  dietary_preferences?: any; // Changed from string[] to any to match Supabase Json type
}

// --- Dashboard Component ---
const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { isEmailVerified, resendConfirmation } = useEmailVerification();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // --- State Management ---
  const [dayData, setDayData] = useState<DayData>({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  const [meals, setMeals] = useState<Meal[]>([]);
  const [manualEntry, setManualEntry] = useState('');
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [analyzedData, setAnalyzedData] = useState<AnalyzedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAnalyzingText, setIsAnalyzingText] = useState(false);
  const [showHealthProfileModal, setShowHealthProfileModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showProfileAlert, setShowProfileAlert] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

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

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      setUserProfile(profile);

      // Check if health profile is incomplete
      if (!profile.height_cm || !profile.weight_kg) {
        if (profile.height_cm === null && profile.weight_kg === null) {
          // First time user - show modal immediately
          setShowHealthProfileModal(true);
        } else {
          // Existing user with incomplete profile - show alert
          setShowProfileAlert(true);
        }
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
    }
  };

  useEffect(() => {
    if (user) {
      loadTodayData();
      loadUserProfile();
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

  const handleAnalysisComplete = (result: AnalyzedResult) => {
    setAnalyzedData(result);
    setIsRecordingModalOpen(false);
    setIsConfirmationModalOpen(true);
  };

  const handleMealConfirmed = async () => {
    setIsConfirmationModalOpen(false);
    setAnalyzedData(null);
    await loadTodayData(); // Refresh data
    toast({
      title: "Meal recorded with distinction",
      description: "Your nutritional entry has been meticulously logged."
    });
  };

  const handleManualEntry = async () => {
    if (!manualEntry.trim()) return;

    setIsAnalyzingText(true);
    try {
        const { data: result, error } = await supabase.functions.invoke('analyze', {
            body: { input: manualEntry },
        });

        if (error) {
            throw error;
        }

        handleAnalysisComplete(result);
        setManualEntry('');

    } catch (error: any) {
        console.error('Error analyzing text entry:', error);
        toast({
            variant: 'destructive',
            title: 'Analysis Failed',
            description: error.message || 'Could not analyze your meal description.'
        });
    } finally {
        setIsAnalyzingText(false);
    }
  };

  const handleResendEmail = async () => {
    setResendingEmail(true);
    const { error } = await resendConfirmation();
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to resend confirmation email. Please try again.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Email Sent",
        description: "A new confirmation email has been sent to your inbox."
      });
    }
    setResendingEmail(false);
  };

  const handleProfileComplete = () => {
    setShowHealthProfileModal(false);
    setShowProfileAlert(false);
    loadUserProfile(); // Refresh profile data
    toast({
      title: "Profile Complete",
      description: "Welcome to your personalized nutrition journey!"
    });
  };

  // --- Chart Data with Enhanced Tooltip ---
  const pieData = [
    { 
      name: 'Protein', 
      value: Math.round(dayData.protein * 4), 
      color: 'hsl(var(--chart-1))',
      grams: Math.round(dayData.protein)
    },
    { 
      name: 'Carbs', 
      value: Math.round(dayData.carbs * 4), 
      color: 'hsl(var(--chart-2))',
      grams: Math.round(dayData.carbs),
      fiber: Math.round(dayData.fiber),
      netCarbs: Math.round(dayData.carbs - dayData.fiber)
    },
    { 
      name: 'Fat', 
      value: Math.round(dayData.fat * 9), 
      color: 'hsl(var(--chart-3))',
      grams: Math.round(dayData.fat)
    }
  ].filter(item => item.value > 0);

  // Enhanced tooltip formatter
  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-md">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm">{data.value} cal</p>
          <p className="text-sm">{data.grams}g {data.name}</p>
          {data.name === 'Carbs' && (
            <div className="text-xs text-muted-foreground mt-1">
              <p>Fiber: {data.fiber}g</p>
              <p>Net Carbs: {data.netCarbs}g</p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

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
      {/* --- Email Verification Banner --- */}
      {user && !isEmailVerified && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-yellow-600 mr-2" />
              <span className="text-sm text-yellow-800">
                Please verify your email address to secure your account.
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResendEmail}
              disabled={resendingEmail}
              className="text-yellow-800 border-yellow-300 hover:bg-yellow-100"
            >
              {resendingEmail ? <Loader2 className="h-3 w-3 animate-spin" /> : "Resend Email"}
            </Button>
          </div>
        </div>
      )}

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
          <div className="flex items-center gap-1 sm:gap-2">
            <NotificationCenter />
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

      {/* --- Profile Completion Alert --- */}
      {showProfileAlert && (
        <Alert className="m-4 border-primary/20 bg-primary/5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Please complete your health profile to receive personalized nutritional insights.</span>
            <div className="flex gap-2 ml-4">
              <Button 
                size="sm" 
                onClick={() => setShowHealthProfileModal(true)}
                className="h-8"
              >
                Complete Profile
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowProfileAlert(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* --- Main Content --- */}
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-8">
          
          {/* --- Macro Chart Card --- */}
          <Card className="card-butler">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-butler-heading text-lg">Today's Nutritional Summary</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/trends')}
                    className="h-8 px-2 text-primary hover:bg-primary/10"
                  >
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Trends
                  </Button>
                </div>
              </div>
              <CardDescription>
                {dayData.calories > 0 
                  ? `${Math.round(dayData.calories)} calories consumed with precision`
                  : "Your ledger awaits the first entry of the day"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <div className="space-y-4">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">{Math.round(dayData.calories)}</div>
                      <div className="text-xs text-muted-foreground">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-chart-1">{Math.round(dayData.protein)}g</div>
                      <div className="text-xs text-muted-foreground">Protein</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-chart-2">{Math.round(dayData.carbs)}g</div>
                      <div className="text-xs text-muted-foreground">Carbs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-chart-3">{Math.round(dayData.fat)}g</div>
                      <div className="text-xs text-muted-foreground">Fat</div>
                    </div>
                  </div>
                  
                  {/* Interactive Chart */}
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
                        <Recharts.Tooltip content={customTooltip} />
                        <Recharts.Legend />
                      </Recharts.PieChart>
                    </Recharts.ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="h-56 sm:h-64 flex items-center justify-center text-mused-foreground">
                  <div className="text-center">
                    <div className="w-16 h-16 border-2 border-dashed border-muted-foreground/30 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <Plus className="w-8 h-8" />
                    </div>
                    <p>No meals recorded yet today</p>
                    <p className="text-xs text-muted-foreground mt-1">Begin your first entry</p>
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
                onClick={() => setIsRecordingModalOpen(true)}
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
                  placeholder="A written note, e.g., 'I had a tomato sandwich for dinner last night'"
                  value={manualEntry}
                  onChange={(e) => setManualEntry(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleManualEntry()}
                  className="flex-1"
                  disabled={isAnalyzingText}
                />
                <Button onClick={handleManualEntry} disabled={!manualEntry.trim() || isAnalyzingText} className="w-full sm:w-auto">
                  {isAnalyzingText ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
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
                <MealCard key={meal.id} meal={meal} onMealUpdated={loadTodayData} />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* --- Modals --- */}
      <RecordingModal
        isOpen={isRecordingModalOpen}
        onClose={() => setIsRecordingModalOpen(false)}
        onRecordingComplete={handleAnalysisComplete}
      />

      <ConfirmationModal
        isOpen={isConfirmationModalOpen}
        onClose={() => setIsConfirmationModalOpen(false)}
        items={analyzedData?.items || []}
        assumptions={analyzedData?.assumptions || []}
        detectedTime={analyzedData?.detected_time}
        onConfirm={handleMealConfirmed}
      />

      <HealthProfileModal
        open={showHealthProfileModal}
        onOpenChange={setShowHealthProfileModal}
        onProfileComplete={handleProfileComplete}
        userId={user?.id || ''}
      />
    </div>
  );
};

export default Dashboard;
