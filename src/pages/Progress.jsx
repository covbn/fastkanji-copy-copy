
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
    const mode = session.mode.replace(/_/g, ' ');
    if (!acc[mode]) {
      acc[mode] = { mode, count: 0, avgAccuracy: 0, total: 0 };
    }
    acc[mode].count++;
    acc[mode].total += session.accuracy;
    acc[mode].avgAccuracy = acc[mode].total / acc[mode].count;
    return acc;
  }, {});

  const modeChartData = Object.values(modeData);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-slate-600">Loading your progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-4 md:p-8 ${nightMode ? 'bg-slate-900' : ''}`}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Your Progress
          </h1>
          <p className={nightMode ? 'text-slate-400' : 'text-slate-600'}>Track your learning journey</p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="border-none shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Zap className="w-8 h-8" />
                <span className="text-3xl font-bold">{sessions.length}</span>
              </div>
              <p className="text-sm opacity-90">Total Sessions</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-emerald-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Target className="w-8 h-8" />
                <span className="text-3xl font-bold">{totalCards}</span>
              </div>
              <p className="text-sm opacity-90">Cards Studied</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Award className="w-8 h-8" />
                <span className="text-3xl font-bold">{avgAccuracy.toFixed(0)}%</span>
              </div>
              <p className="text-sm opacity-90">Avg Accuracy</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-orange-500 to-red-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Brain className="w-8 h-8" />
                <span className="text-3xl font-bold">{progress.length}</span>
              </div>
              <p className="text-sm opacity-90">Words Learned</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Accuracy Over Time */}
          <Card className={`border-none shadow-xl ${nightMode ? 'bg-slate-800/80' : 'bg-white/80'} backdrop-blur-sm`}>
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
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
                      stroke="#6366f1" 
                      strokeWidth={3}
                      dot={{ fill: '#6366f1', r: 4 }}
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
          <Card className={`border-none shadow-xl ${nightMode ? 'bg-slate-800/80' : 'bg-white/80'} backdrop-blur-sm`}>
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600" />
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
                    <Bar dataKey="avgAccuracy" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
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
          <Card className={`border-none shadow-xl ${nightMode ? 'bg-slate-800/80' : 'bg-white/80'} backdrop-blur-sm`}>
            <CardHeader className={`border-b ${nightMode ? 'border-slate-700' : 'border-slate-100'}`}>
              <CardTitle className={nightMode ? 'text-slate-100' : ''}>Recent Study Sessions</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {sessions.slice(0, 10).map((session) => (
                  <div
                    key={session.id}
                    className={`flex items-center justify-between p-4 rounded-xl ${nightMode ? 'bg-slate-700/50 hover:bg-slate-700' : 'bg-slate-50 hover:bg-slate-100'} transition-colors`}
                  >
                    <div className="flex items-center gap-4">
                      {session.session_type === 'flash' ? (
                        <Zap className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <Brain className="w-5 h-5 text-purple-600" />
                      )}
                      <div>
                        <p className={`font-medium ${nightMode ? 'text-slate-200' : 'text-slate-900'}`}>
                          {session.mode.replace(/_/g, ' → ').toUpperCase()}
                        </p>
                        <p className={`text-sm ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {format(new Date(session.created_date), 'MMM d, yyyy h:mm a')} • {session.level}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${nightMode ? 'text-slate-100' : 'text-slate-900'}`}>
                        {session.accuracy.toFixed(0)}%
                      </p>
                      <p className={`text-sm ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
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
