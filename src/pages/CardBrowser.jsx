import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Brain, Clock, CheckCircle, Search } from "lucide-react";
import { FixedSizeList as List } from 'react-window';
import { normalizeVocabArray, getUiLevels } from "@/components/utils/vocabNormalizer";
import { getCardState } from "@/components/scheduler/sm2Anki";
import { useDebounce } from "@/components/utils/useDebounce";

/**
 * Derive card display state from progress (shared logic for counts & filters)
 */
function deriveCardState(vocab, progress, now) {
  const card = getCardState(progress, vocab);
  
  if (card.state === "New") {
    return "new";
  } else if (card.state === "Learning" || card.state === "Relearning") {
    return card.dueAt <= now ? "learning_due" : "learning";
  } else if (card.state === "Review") {
    return card.dueAt <= now ? "due" : "reviewed";
  }
  return "new";
}

export default function CardBrowser() {
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  
  // Debounce search to avoid filtering on every keystroke
  const debouncedSearch = useDebounce(searchQuery, 200);

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

  // Pre-compute progress map, derived states, and search keys (memoized)
  const { progressMap, cardsWithState, searchIndex } = useMemo(() => {
    const now = Date.now();
    const pMap = new Map(userProgress.map(p => [p.vocabulary_id, p]));
    const cards = [];
    const sIndex = new Map();
    
    allVocabulary.forEach(vocab => {
      const progress = pMap.get(vocab.id);
      const derivedState = deriveCardState(vocab, progress, now);
      const card = getCardState(progress, vocab);
      
      cards.push({
        vocab,
        progress,
        derivedState,
        card,
        dueAt: card.dueAt
      });
      
      // Pre-compute search key
      const searchKey = `${vocab.kanji} ${vocab.hiragana} ${vocab.meaning}`.toLowerCase();
      sIndex.set(vocab.id, searchKey);
    });
    
    return { progressMap: pMap, cardsWithState: cards, searchIndex: sIndex };
  }, [allVocabulary, userProgress]);
  
  // Categorize for stats (memoized)
  const stats = useMemo(() => {
    const counts = { new: 0, learning: 0, due: 0, reviewed: 0 };
    cardsWithState.forEach(c => {
      if (c.derivedState === "new") counts.new++;
      else if (c.derivedState === "learning" || c.derivedState === "learning_due") counts.learning++;
      else if (c.derivedState === "due") counts.due++;
      else if (c.derivedState === "reviewed") counts.reviewed++;
    });
    return counts;
  }, [cardsWithState]);

  // Apply filters (memoized, uses debounced search)
  const filteredCards = useMemo(() => {
    let cards = cardsWithState;
    
    // State filter
    if (stateFilter !== "all") {
      if (stateFilter === "learning") {
        cards = cards.filter(c => c.derivedState === "learning" || c.derivedState === "learning_due");
      } else {
        cards = cards.filter(c => c.derivedState === stateFilter);
      }
    }
    
    // Level filter
    if (levelFilter !== "all") {
      cards = cards.filter(c => c.vocab.level === levelFilter);
    }
    
    // Search filter (debounced)
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      cards = cards.filter(c => searchIndex.get(c.vocab.id).includes(query));
    }
    
    return cards;
  }, [cardsWithState, stateFilter, levelFilter, debouncedSearch, searchIndex]);

  const getStateInfo = (derivedState) => {
    if (derivedState === "new") {
      return { label: "New", color: "bg-cyan-500", icon: BookOpen };
    } else if (derivedState === "learning" || derivedState === "learning_due") {
      return { label: "Learning", color: "bg-amber-500", icon: Brain };
    } else if (derivedState === "due") {
      return { label: "Due", color: "bg-emerald-500", icon: Clock };
    } else if (derivedState === "reviewed") {
      return { label: "Reviewed", color: "bg-slate-500", icon: CheckCircle };
    }
    return { label: "Unknown", color: "bg-slate-500", icon: CheckCircle };
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
                  <p className="text-2xl font-bold text-foreground">{stats.new}</p>
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
                  <p className="text-2xl font-bold text-foreground">{stats.learning}</p>
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
                  <p className="text-2xl font-bold text-foreground">{stats.due}</p>
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
                  <p className="text-2xl font-bold text-foreground">{stats.reviewed}</p>
                  <p className="text-sm text-muted-foreground">Reviewed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
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

        {/* Cards List - Virtualized */}
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="text-card-foreground">
              {filteredCards.length} Cards
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredCards.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No cards found matching your filters</p>
              </div>
            ) : (
              <List
                height={600}
                itemCount={filteredCards.length}
                itemSize={90}
                width="100%"
                className="custom-scrollbar"
              >
                {({ index, style }) => {
                  const card = filteredCards[index];
                  const stateInfo = getStateInfo(card.derivedState);
                  const StateIcon = stateInfo.icon;
                  
                  return (
                    <div style={style} className="px-4 py-2">
                      <div className="p-4 rounded-lg border bg-muted hover:bg-accent border-border transition-colors h-full">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className={`w-10 h-10 rounded-lg ${stateInfo.color} flex items-center justify-center flex-shrink-0`}>
                              <StateIcon className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-xl font-semibold text-foreground" style={{fontFamily: "'Crimson Pro', serif"}}>
                                  {card.vocab.kanji}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {card.vocab.hiragana}
                                </p>
                              </div>
                              <p className="text-sm text-muted-foreground truncate">
                                {card.vocab.meaning}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant="outline">
                              {card.vocab.level}
                            </Badge>
                            <Badge className={`${stateInfo.color} text-white`}>
                              {stateInfo.label}
                            </Badge>
                            {card.progress && (
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">
                                  Next: {formatNextReview(card.progress.next_review)}
                                </p>
                                {card.card.ease > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    Ease: {card.card.ease.toFixed(1)}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }}
              </List>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}