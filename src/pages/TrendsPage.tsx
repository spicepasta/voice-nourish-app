import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { format, subDays, startOfDay } from 'date-fns';

interface DayData {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  k_mg?: number;
}

export default function TrendsPage() {
  const [trendData, setTrendData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      loadTrendData();
    }
  }, [user]);

  const loadTrendData = async () => {
    if (!user) return;

    const thirtyDaysAgo = startOfDay(subDays(new Date(), 30));
    
    try {
      const { data: meals, error } = await supabase
        .from('meals')
        .select('logged_date, total_calories, protein, carbs, fat, fiber, micronutrients')
        .eq('user_id', user.id)
        .gte('logged_date', format(thirtyDaysAgo, 'yyyy-MM-dd'))
        .order('logged_date', { ascending: true });

      if (error) throw error;

      // Group meals by date and sum nutrients
      const dailyTotals: Record<string, DayData> = {};

      meals?.forEach(meal => {
        const date = meal.logged_date;
        if (!dailyTotals[date]) {
          dailyTotals[date] = {
            date,
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
            k_mg: 0
          };
        }

        dailyTotals[date].calories += meal.total_calories || 0;
        dailyTotals[date].protein += meal.protein || 0;
        dailyTotals[date].carbs += meal.carbs || 0;
        dailyTotals[date].fat += meal.fat || 0;
        dailyTotals[date].fiber += meal.fiber || 0;

        // Extract potassium from micronutrients
        if (meal.micronutrients && typeof meal.micronutrients === 'object' && !Array.isArray(meal.micronutrients)) {
          const micros = meal.micronutrients as any;
          if (micros.k_mg && typeof micros.k_mg === 'number') {
            dailyTotals[date].k_mg = (dailyTotals[date].k_mg || 0) + micros.k_mg;
          }
        }
      });

      // Convert to array and fill missing days with zeros
      const trendArray: DayData[] = [];
      for (let i = 0; i < 30; i++) {
        const date = format(subDays(new Date(), 29 - i), 'yyyy-MM-dd');
        trendArray.push(dailyTotals[date] || {
          date,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          k_mg: 0
        });
      }

      setTrendData(trendArray);
    } catch (error) {
      console.error('Error loading trend data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'MMM d');
  };

  const chartConfig = {
    calories: { stroke: 'hsl(var(--primary))' },
    protein: { stroke: 'hsl(var(--destructive))' },
    carbs: { stroke: 'hsl(var(--warning))' },
    fat: { stroke: 'hsl(var(--secondary))' },
    fiber: { stroke: 'hsl(var(--success))' },
    k_mg: { stroke: 'hsl(var(--info))' }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="flex items-center justify-between p-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-xl font-semibold">Nutrition Trends</h1>
          <div></div>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-6">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily Calories</CardTitle>
              <CardDescription>Total caloric intake over the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    fontSize={12}
                  />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    labelFormatter={(value) => formatDate(value as string)}
                    formatter={(value: number) => [Math.round(value), 'Calories']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="calories" 
                    stroke={chartConfig.calories.stroke}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Protein Intake</CardTitle>
                <CardDescription>Daily protein consumption (grams)</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={formatDate}
                      fontSize={12}
                    />
                    <YAxis fontSize={12} />
                    <Tooltip 
                      labelFormatter={(value) => formatDate(value as string)}
                      formatter={(value: number) => [Math.round(value), 'g']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="protein" 
                      stroke={chartConfig.protein.stroke}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Carbohydrates</CardTitle>
                <CardDescription>Daily carb consumption (grams)</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={formatDate}
                      fontSize={12}
                    />
                    <YAxis fontSize={12} />
                    <Tooltip 
                      labelFormatter={(value) => formatDate(value as string)}
                      formatter={(value: number) => [Math.round(value), 'g']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="carbs" 
                      stroke={chartConfig.carbs.stroke}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fat Intake</CardTitle>
                <CardDescription>Daily fat consumption (grams)</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={formatDate}
                      fontSize={12}
                    />
                    <YAxis fontSize={12} />
                    <Tooltip 
                      labelFormatter={(value) => formatDate(value as string)}
                      formatter={(value: number) => [Math.round(value), 'g']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="fat" 
                      stroke={chartConfig.fat.stroke}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fiber Intake</CardTitle>
                <CardDescription>Daily fiber consumption (grams)</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={formatDate}
                      fontSize={12}
                    />
                    <YAxis fontSize={12} />
                    <Tooltip 
                      labelFormatter={(value) => formatDate(value as string)}
                      formatter={(value: number) => [Math.round(value), 'g']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="fiber" 
                      stroke={chartConfig.fiber.stroke}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {trendData.some(d => d.k_mg && d.k_mg > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Potassium Intake</CardTitle>
                <CardDescription>Daily potassium consumption (mg)</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={formatDate}
                      fontSize={12}
                    />
                    <YAxis fontSize={12} />
                    <Tooltip 
                      labelFormatter={(value) => formatDate(value as string)}
                      formatter={(value: number) => [Math.round(value), 'mg']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="k_mg" 
                      stroke={chartConfig.k_mg.stroke}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}