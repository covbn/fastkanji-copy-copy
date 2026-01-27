import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Calendar, Target, Award, Zap, Brain } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns";

export default function Progress() {
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['allSessions'],
    queryFn: () => base44.entities.StudySession.list('-created_date', 50),
  });

  const { data: progress = [] } = useQuery({
    queryKey: ['userProgress'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.UserProgress.filter({ user_email: user.email });
    },
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: settings } = useQuery({
    queryKey: ['userSettings', user?.email],
    queryFn: async () => {
      if (!user) return null;
      const existing = await base44.entities.UserSettings.filter({ user_email: user.email });
      return existing.length > 0 ? existing[0] : null;
    },
    enabled: !!user,
  });

  const nightMode = settings?.night_mode || false;

  // Calculate stats
  const totalCards = sessions.reduce((sum, s) => sum + s.total_cards, 0);
  const avgAccuracy = sessions.length > 0 
    ? sessions.reduce((sum, s) => sum + s.accuracy, 0) / sessions.length 
    : 0;
  const totalCorrect = sessions.reduce((sum, s) => sum + s.correct_answers, 0);
  
  // Prepare chart data
  const chartData = sessions
    .slice(0, 20)
    .reverse()
    .map((session) => ({
      date: format(new Date(session.created_date), 'MM/dd'),
      accuracy: session.accuracy,
      cards: session.total_cards,
    }));

  const modeData = sessions.reduce((acc, session) => {
    // Convert mode to readable format
    let modeName = session.mode.replace(/_/g, ' ');
    // Remove obsolete "reading to hiragana"
    if (modeName === 'reading to hiragana') return acc;
    
    if (!acc[modeName]) {
      acc[modeName] = { mode: modeName, count: 0, avgAccuracy: 0, total: 0 };
    }
    acc[modeName].count++;
    acc[modeName].total += session.accuracy;
    acc[modeName].avgAccuracy = acc[modeName].total / acc[modeName].count;
    return acc;
  }, {});

  const modeChartData = Object.values(modeData);

  const formatModeName = (mode) => {
    return mode.replace(/_/g, ' ').replace('to', '→');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="text-slate-600">Loading your progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-background">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-semibold text-foreground" style={{fontFamily: "'Crimson Pro', serif"}}>
            Your Progress
          </h1>
          <p className="text-muted-foreground">Track your learning journey</p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="border shadow-sm border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-12 h-12 rounded-lg bg-teal-500 flex items-center justify-center shadow-sm`}>
                  <Zap className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-foreground">{sessions.length}</p>
              <p className="text-sm mt-1 text-muted-foreground">Total Sessions</p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-12 h-12 rounded-lg bg-emerald-500 flex items-center justify-center shadow-sm`}>
                  <Target className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-foreground">{totalCards}</p>
              <p className="text-sm mt-1 text-muted-foreground">Cards Studied</p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-12 h-12 rounded-lg bg-cyan-500 flex items-center justify-center shadow-sm`}>
                  <Award className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-foreground">{avgAccuracy.toFixed(0)}%</p>
              <p className="text-sm mt-1 text-muted-foreground">Avg Accuracy</p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-12 h-12 rounded-lg bg-amber-500 flex items-center justify-center shadow-sm`}>
                  <Brain className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-foreground">{progress.length}</p>
              <p className="text-sm mt-1 text-muted-foreground">Words Learned</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Accuracy Over Time */}
          <Card className="border shadow-sm border-border bg-card">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <TrendingUp className="w-5 h-5 text-teal-600" />
                Accuracy Trend
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#64748b" />
                    <YAxis stroke="#64748b" domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="accuracy" 
                      stroke="#14b8a6" 
                      strokeWidth={3}
                      dot={{ fill: '#14b8a6', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-400">
                  No data yet. Start studying to see your progress!
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performance by Mode */}
          <Card className="border shadow-sm border-border bg-card">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <Calendar className="w-5 h-5 text-cyan-600" />
                Performance by Mode
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {modeChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={modeChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mode" stroke="#64748b" />
                    <YAxis stroke="#64748b" domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Bar dataKey="avgAccuracy" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-400">
                  No data yet. Start studying to see your progress!
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Sessions Detail */}
        {sessions.length > 0 && (
          <Card className="border shadow-sm border-border bg-card">
            <CardHeader className={`border-b ${nightMode ? 'border-slate-700' : 'border-stone-200'}`}>
              <CardTitle className={nightMode ? 'text-slate-100' : 'text-slate-800'}>Recent Study Sessions</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {sessions.slice(0, 10).map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-muted hover:bg-accent border-border transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {session.session_type === 'flash' ? (
                        <Zap className="w-5 h-5 text-teal-600" />
                      ) : (
                        <Brain className="w-5 h-5 text-cyan-600" />
                      )}
                      <div>
                        <p className="font-medium text-foreground">
                          {formatModeName(session.mode).toUpperCase()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(session.created_date), 'MMM d, yyyy h:mm a')} • {session.level}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">
                        {session.accuracy.toFixed(0)}%
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {session.correct_answers}/{session.total_cards} correct
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}