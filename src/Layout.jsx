import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Zap, Brain, TrendingUp, Home, BookOpen, User, Crown, MessageSquare } from "lucide-react"; // Added Crown and MessageSquare import
import { Settings as SettingsIcon, Wind } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/toaster";

const navigationItems = [
  {
    title: "Home",
    url: createPageUrl("Home"),
    icon: Home,
  },
  {
    title: "Flash Study",
    url: createPageUrl("FlashStudy"),
    icon: Zap,
  },
  {
    title: "Spaced Repetition",
    url: createPageUrl("SpacedRepetition"),
    icon: Brain,
  },
  {
    title: "Card Browser",
    url: createPageUrl("CardBrowser"),
    icon: BookOpen,
  },
  {
    title: "Progress",
    url: createPageUrl("Progress"),
    icon: TrendingUp,
  },
  {
    title: "Profile",
    url: createPageUrl("Profile"),
    icon: User,
  },
];

const bottomNavigationItems = [
  {
    title: "Focus Exercise",
    url: createPageUrl("Focus"),
    icon: Wind,
  },
  {
    title: "Feedback & Bugs",
    url: createPageUrl("Feedback"),
    icon: MessageSquare,
  },
  {
    title: "Settings",
    url: createPageUrl("Settings"),
    icon: SettingsIcon,
  },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();

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

  // Apply theme globally on mount and when settings change
  React.useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme ? savedTheme === 'dark' : (settings?.night_mode || false);
    
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings?.night_mode]);

  const nightMode = settings?.night_mode || localStorage.getItem('theme') === 'dark';
  const isPremium = settings?.subscription_status === 'premium';

  return (
    <SidebarProvider>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Crimson+Pro:wght@400;600&display=swap');
          
          :root {
            --background: 0 0% 100%;
            --foreground: 222.2 84% 4.9%;
            --card: 0 0% 100%;
            --card-foreground: 222.2 84% 4.9%;
            --popover: 0 0% 100%;
            --popover-foreground: 222.2 84% 4.9%;
            --primary: 180 35% 55%;
            --primary-foreground: 0 0% 100%;
            --secondary: 210 40% 96.1%;
            --secondary-foreground: 222.2 47.4% 11.2%;
            --muted: 210 40% 96.1%;
            --muted-foreground: 215.4 16.3% 46.9%;
            --accent: 210 40% 96.1%;
            --accent-foreground: 222.2 47.4% 11.2%;
            --destructive: 0 84.2% 60.2%;
            --destructive-foreground: 210 40% 98%;
            --border: 214.3 31.8% 91.4%;
            --input: 214.3 31.8% 91.4%;
            --ring: 180 35% 55%;
            --radius: 0.5rem;
          }

          .dark {
            --background: 222.2 84% 4.9%;
            --foreground: 210 40% 98%;
            --card: 222.2 84% 4.9%;
            --card-foreground: 210 40% 98%;
            --popover: 222.2 84% 4.9%;
            --popover-foreground: 210 40% 98%;
            --primary: 180 35% 55%;
            --primary-foreground: 0 0% 100%;
            --secondary: 217.2 32.6% 17.5%;
            --secondary-foreground: 210 40% 98%;
            --muted: 217.2 32.6% 17.5%;
            --muted-foreground: 215 20.2% 65.1%;
            --accent: 217.2 32.6% 17.5%;
            --accent-foreground: 210 40% 98%;
            --destructive: 0 62.8% 30.6%;
            --destructive-foreground: 210 40% 98%;
            --border: 217.2 32.6% 17.5%;
            --input: 217.2 32.6% 17.5%;
            --ring: 180 35% 55%;
          }
          
          * {
            border-color: hsl(var(--border));
          }
          
          body {
            background-color: hsl(var(--background));
            color: hsl(var(--foreground));
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          }
          
          h1, h2, h3, h4, h5, h6 {
            font-family: 'Crimson Pro', serif;
          }
          
          b, strong {
            font-weight: 700;
            color: inherit;
          }

          /* Custom Scrollbar Styles */
          .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }

          .custom-scrollbar::-webkit-scrollbar-track {
            background: hsl(var(--muted));
            border-radius: 4px;
          }

          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: hsl(var(--muted-foreground));
            border-radius: 4px;
          }

          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: hsl(var(--foreground) / 0.5);
          }

          /* Firefox */
          .custom-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: hsl(var(--muted-foreground)) hsl(var(--muted));
          }

          /* Default scrollbar improvements */
          ::-webkit-scrollbar {
            width: 10px;
            height: 10px;
          }

          ::-webkit-scrollbar-track {
            background: hsl(var(--background));
          }

          ::-webkit-scrollbar-thumb {
            background: hsl(var(--muted-foreground) / 0.5);
            border-radius: 5px;
          }

          ::-webkit-scrollbar-thumb:hover {
            background: hsl(var(--muted-foreground));
          }

          * {
            scrollbar-width: thin;
            scrollbar-color: hsl(var(--muted-foreground) / 0.5) hsl(var(--background));
          }
        `}
      </style>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <Sidebar className="border-r border-border bg-card backdrop-blur-sm">
          <SidebarHeader className="border-b border-border p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-2xl">速</span>
              </div>
              <div>
                <h2 className="font-semibold text-xl text-foreground" style={{fontFamily: "'Crimson Pro', serif"}}>
                  FastKanji
                </h2>
                <p className="text-xs text-muted-foreground">速く学ぶ</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            {/* Premium Badge */}
            {!isPremium && (
              <div className="px-3 py-2 mb-4">
                <Link to={createPageUrl("Subscription")}>
                  <div className="p-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white cursor-pointer hover:from-amber-600 hover:to-orange-600 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                      <Crown className="w-4 h-4" />
                      <span className="font-semibold text-sm">Upgrade to Premium</span>
                    </div>
                    <p className="text-xs opacity-90">Unlock all features!</p>
                  </div>
                </Link>
              </div>
            )}

            {isPremium && (
              <div className="px-3 py-2 mb-4">
                <div className="p-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4" />
                    <span className="font-semibold text-sm">Premium Member</span>
                  </div>
                </div>
              </div>
            )}

            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2">
                Study
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-accent hover:text-accent-foreground transition-all duration-200 rounded-lg mb-1 ${
                          location.pathname === item.url 
                            ? 'bg-teal-500 text-white shadow-sm' 
                            : 'text-foreground'
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-2.5">
                          <item.icon className="w-4 h-4" />
                          <span className="font-medium text-sm">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-4">
              <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2">
                Tools
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {bottomNavigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-accent hover:text-accent-foreground transition-all duration-200 rounded-lg mb-1 ${
                          location.pathname === item.url 
                            ? 'bg-teal-500 text-white shadow-sm' 
                            : 'text-foreground'
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-2.5">
                          <item.icon className="w-4 h-4" />
                          <span className="font-medium text-sm">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-border p-4">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted">
                <span className="text-teal-600 font-semibold text-sm">学</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate text-foreground">Learner</p>
                <p className="text-xs truncate text-muted-foreground">頑張って</p>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-card/95 border-b border-border backdrop-blur-sm px-6 py-4 md:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-accent p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-semibold text-foreground" style={{fontFamily: "'Crimson Pro', serif"}}>
                FastKanji
              </h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
      <Toaster />
    </SidebarProvider>
  );
}