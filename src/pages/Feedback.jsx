import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Bug, Lightbulb, Send, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function Feedback() {
  const navigate = useNavigate();
  const [feedbackType, setFeedbackType] = useState("feedback");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

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

  const submitMutation = useMutation({
    mutationFn: async (data) => {
      // In a real app, this would send to a backend
      // For now, we'll just log it
      console.log("Feedback submitted:", data);
      return Promise.resolve(data);
    },
    onSuccess: () => {
      setSubmitted(true);
      setTimeout(() => {
        navigate(createPageUrl('Home'));
      }, 2000);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    submitMutation.mutate({
      type: feedbackType,
      message: message.trim(),
      user_email: user?.email,
      timestamp: new Date().toISOString(),
    });
  };

  if (submitted) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${nightMode ? 'bg-slate-900' : 'bg-stone-50'}`}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-6 max-w-md"
        >
          <div className="w-24 h-24 mx-auto rounded-full bg-emerald-500 flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h2 className={`text-3xl font-semibold ${nightMode ? 'text-slate-100' : 'text-slate-800'}`} style={{fontFamily: "'Crimson Pro', serif"}}>
            Thank You!
          </h2>
          <p className={nightMode ? 'text-slate-400' : 'text-slate-600'}>
            Your {feedbackType === 'bug' ? 'bug report' : 'feedback'} has been submitted. 
            We appreciate you helping us improve FastKanji!
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-4 md:p-8 ${nightMode ? 'bg-slate-900' : 'bg-stone-50'}`}>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-lg">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className={`text-4xl font-semibold ${nightMode ? 'text-slate-100' : 'text-slate-800'}`} style={{fontFamily: "'Crimson Pro', serif"}}>
            Feedback & Bug Reports
          </h1>
          <p className={nightMode ? 'text-slate-400' : 'text-slate-600'}>
            Help us improve FastKanji by sharing your thoughts or reporting issues
          </p>
        </motion.div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className={`border ${nightMode ? 'border-slate-700 bg-slate-800' : 'border-stone-200 bg-white'}`}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-teal-500 flex items-center justify-center flex-shrink-0">
                  <Lightbulb className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className={`font-semibold mb-2 ${nightMode ? 'text-slate-100' : 'text-slate-800'}`}>Feedback</h3>
                  <p className={`text-sm ${nightMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Share feature requests, improvements, or general thoughts about FastKanji
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border ${nightMode ? 'border-slate-700 bg-slate-800' : 'border-stone-200 bg-white'}`}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-rose-500 flex items-center justify-center flex-shrink-0">
                  <Bug className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className={`font-semibold mb-2 ${nightMode ? 'text-slate-100' : 'text-slate-800'}`}>Bug Report</h3>
                  <p className={`text-sm ${nightMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Found something broken? Let us know so we can fix it quickly
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Form */}
        <Card className={`border shadow-sm ${nightMode ? 'border-slate-700 bg-slate-800' : 'border-stone-200 bg-white'}`}>
          <CardHeader className={`border-b ${nightMode ? 'border-slate-700' : 'border-stone-200'}`}>
            <CardTitle className={nightMode ? 'text-slate-100' : 'text-slate-800'}>
              Submit {feedbackType === 'bug' ? 'Bug Report' : 'Feedback'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label className={nightMode ? 'text-slate-200' : 'text-slate-800'}>Type</Label>
                <Select value={feedbackType} onValueChange={setFeedbackType}>
                  <SelectTrigger className={nightMode ? 'bg-slate-700 border-slate-600 text-slate-100' : ''}>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feedback">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="w-4 h-4" />
                        Feedback / Feature Request
                      </div>
                    </SelectItem>
                    <SelectItem value="bug">
                      <div className="flex items-center gap-2">
                        <Bug className="w-4 h-4" />
                        Bug Report
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className={nightMode ? 'text-slate-200' : 'text-slate-800'}>
                  {feedbackType === 'bug' ? 'Describe the bug' : 'Your feedback'}
                </Label>
                <Textarea
                  placeholder={
                    feedbackType === 'bug'
                      ? "Please describe what happened, what you expected to happen, and any steps to reproduce the issue..."
                      : "Share your thoughts, suggestions, or feature requests..."
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={`min-h-[200px] ${nightMode ? 'bg-slate-700 border-slate-600 text-slate-100' : ''}`}
                  required
                />
              </div>

              <div className={`p-4 rounded-lg ${nightMode ? 'bg-slate-700' : 'bg-teal-50'} border ${nightMode ? 'border-slate-600' : 'border-teal-200'}`}>
                <p className={`text-sm ${nightMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  <strong>Note:</strong> Your email ({user?.email}) will be included with your submission 
                  so we can follow up if needed.
                </p>
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(createPageUrl('Home'))}
                  className={`flex-1 ${nightMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : ''}`}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                  disabled={!message.trim() || submitMutation.isPending}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {submitMutation.isPending ? 'Submitting...' : 'Submit'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <Card className={`border ${nightMode ? 'border-slate-700 bg-slate-800' : 'border-stone-200 bg-white'}`}>
          <CardContent className="p-6">
            <h3 className={`font-semibold mb-3 ${nightMode ? 'text-slate-100' : 'text-slate-800'}`}>
              What happens next?
            </h3>
            <ul className={`space-y-2 text-sm ${nightMode ? 'text-slate-400' : 'text-slate-600'}`}>
              <li>• We review all feedback and bug reports carefully</li>
              <li>• Bug fixes are typically addressed within 1-2 weeks</li>
              <li>• Feature requests are evaluated and prioritized</li>
              <li>• We may reach out for clarification if needed</li>
              <li>• Thank you for helping us improve FastKanji! 🙏</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}