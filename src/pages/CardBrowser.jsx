import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Brain, Clock, CheckCircle, Search } from "lucide-react";
import { motion } from "framer-motion";
import { normalizeVocabArray, getUiLevels } from "@/components/utils/vocabNormalizer";

export default function CardBrowser() {
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");

  const { data: rawVocabulary = [], isLoading: isLoadingVocab } = useQuery({
    queryKey: ['allVocabulary'],
    queryFn: () => base44.entities.Vocabulary.list(),
  });

  // Normalize vocabulary data (single source of truth)
  const allVocabulary = React.useMemo(() => {
    const normalized = normalizeVocabArray(rawVocabulary);
    console.log('[CardBrowser] Loaded', rawVocabulary.length, 'raw vocab,', normalized.length, 'normalized cards');
    return normalized;
  }, [rawVocabulary]);

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

  const { data: userProgress = [], isLoading: isLoadingProgress } = useQuery({
    queryKey: ['userProgress', user?.email],
    queryFn: async () => {
      if (!user) return [];
      return base44.entities.UserProgress.filter({ user_email: user.email });
    },
    enabled: !!user,
  });

  const progressMap = new Map(userProgress.map(p => [p.vocabulary_id, p]));

  // Categorize all cards
  const categorizedCards = React.useMemo(() => {
    const now = new Date();
    const newCards = [];
    const learningCards = [];
    const dueCards = [];
    const reviewedCards = [];

    allVocabulary.forEach(word => {
      const progress = progressMap.get(word.id);
      
      if (!progress || progress.state === "New") {
        newCards.push({ word, progress: null });
      } else if (progress.state === "Learning" || progress.state === "Relearning") {
        const nextReview = new Date(progress.next_review);
        if (nextReview <= now) {
          learningCards.push({ word, progress, isDue: true });
        } else {
          learningCards.push({ word, progress, isDue: false });
        }
      } else if (progress.state === "Review") {
        const nextReview = new Date(progress.next_review);
        if (nextReview <= now) {
          dueCards.push({ word, progress });
        } else {
          reviewedCards.push({ word, progress });
        }
      }
    });

    return { newCards, learningCards, dueCards, reviewedCards };
  }, [allVocabulary, userProgress]);

  // Apply filters
  const filteredCards = React.useMemo(() => {
    let cards = [];
    
    if (stateFilter === "all") {
      cards = [
        ...categorizedCards.newCards,
        ...categorizedCards.learningCards,
        ...categorizedCards.dueCards,
        ...categorizedCards.reviewedCards
      ];
    } else if (stateFilter === "new") {
      cards = categorizedCards.newCards;
    } else if (stateFilter === "learning") {
      cards = categorizedCards.learningCards;
    } else if (stateFilter === "due") {
      cards = categorizedCards.dueCards;
    } else if (stateFilter === "reviewed") {
      cards = categorizedCards.reviewedCards;
    }

    if (levelFilter !== "all") {
      cards = cards.filter(c => c.word.level === levelFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      cards = cards.filter(c => 
        c.word.kanji.toLowerCase().includes(query) ||
        c.word.hiragana.toLowerCase().includes(query) ||
        c.word.meaning.toLowerCase().includes(query)
      );
    }

    return cards;
  }, [categorizedCards, stateFilter, levelFilter, searchQuery]);

  const getStateInfo = (card) => {
    if (!card.progress) {
      return { label: "New", color: "bg-cyan-500", icon: BookOpen };
    }
    
    const state = card.progress.state;
    const now = new Date();
    const nextReview = new Date(card.progress.next_review);
    
    if (state === "Learning" || state === "Relearning") {
      if (nextReview <= now) {
        return { label: state, color: "bg-amber-500", icon: Brain, isDue: true };
      }
      return { label: state, color: "bg-amber-500", icon: Brain, isDue: false };
    } else if (state === "Review") {
      if (nextReview <= now) {
        return { label: "Due", color: "bg-emerald-500", icon: Clock, isDue: true };
      }
      return { label: "Review", color: "bg-slate-500", icon: CheckCircle, isDue: false };
    }
    
    return { label: state, color: "bg-slate-500", icon: CheckCircle };
  };

  const formatNextReview = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMs < 0) return "Due now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 30) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  if (isLoadingVocab || isLoadingProgress) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="text-slate-600">Loading cards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-background">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-semibold text-foreground" style={{fontFamily: "'Crimson Pro', serif"}}>
            Card Browser
          </h1>
          <p className="text-muted-foreground">View and track all your vocabulary cards</p>
        </div>

        {/* Summary Stats */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="border shadow-sm border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{categorizedCards.newCards.length}</p>
                  <p className="text-sm text-muted-foreground">New</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{categorizedCards.learningCards.length}</p>
                  <p className="text-sm text-muted-foreground">Learning</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{categorizedCards.dueCards.length}</p>
                  <p className="text-sm text-muted-foreground">Due Now</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-500 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{categorizedCards.reviewedCards.length}</p>
                  <p className="text-sm text-muted-foreground">Reviewed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className={`border shadow-sm ${nightMode ? 'border-slate-700 bg-slate-800' : 'border-stone-200 bg-white'}`}>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by kanji, reading, or meaning..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="learning">Learning</SelectItem>
                  <SelectItem value="due">Due Now</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-full md:w-32">
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {getUiLevels().map(lvl => (
                    <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Cards List */}
        <Card className={`border shadow-sm ${nightMode ? 'border-slate-700 bg-slate-800' : 'border-stone-200 bg-white'}`}>
          <CardHeader className="border-b border-border">
            <CardTitle className="text-card-foreground">
              {filteredCards.length} Cards
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
              {filteredCards.map((card, idx) => {
                const stateInfo = getStateInfo(card);
                const StateIcon = stateInfo.icon;
                
                return (
                  <motion.div
                    key={card.word.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className="p-4 rounded-lg border bg-muted hover:bg-accent border-border transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-lg ${stateInfo.color} flex items-center justify-center flex-shrink-0`}>
                          <StateIcon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-xl font-semibold text-foreground" style={{fontFamily: "'Crimson Pro', serif"}}>
                              {card.word.kanji}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {card.word.hiragana}
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {card.word.meaning}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline">
                          {card.word.level}
                        </Badge>
                        <Badge className={`${stateInfo.color} text-white`}>
                          {stateInfo.label}
                        </Badge>
                        {card.progress && (
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">
                              Next: {formatNextReview(card.progress.next_review)}
                            </p>
                            {card.progress.difficulty && (
                              <p className="text-xs text-muted-foreground">
                                Diff: {card.progress.difficulty.toFixed(1)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {filteredCards.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No cards found matching your filters</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}