import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function SpacedRepetition() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50">
      <Card className="max-w-2xl w-full border-none shadow-2xl">
        <CardContent className="p-12 text-center space-y-6">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center shadow-xl">
            <Brain className="w-12 h-12 text-white" />
          </div>
          
          <div className="space-y-3">
            <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              Spaced Repetition
            </h2>
            <p className="text-xl text-slate-600">
              Coming Soon! もうすぐです
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-6 space-y-4">
            <Clock className="w-8 h-8 text-indigo-600 mx-auto" />
            <p className="text-slate-700">
              The intelligent spaced repetition system is being built to help you review words at the perfect moment for optimal retention.
            </p>
            <ul className="text-sm text-slate-600 space-y-2 text-left max-w-md mx-auto">
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 mt-1">•</span>
                <span>Review words based on your performance history</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 mt-1">•</span>
                <span>Adaptive scheduling that learns from your progress</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 mt-1">•</span>
                <span>Focus on words you struggle with most</span>
              </li>
            </ul>
          </div>

          <Button
            onClick={() => navigate(createPageUrl('Home'))}
            size="lg"
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            Back to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}