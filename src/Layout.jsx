
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Zap, Brain, TrendingUp, Home } from "lucide-react";
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
    title: "Progress",
    url: createPageUrl("Progress"),
    icon: TrendingUp,
  },
];

const bottomNavigationItems = [
  {
    title: "Focus Exercise",
    url: createPageUrl("Focus"),
    icon: Wind,
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

  const nightMode = settings?.night_mode || false;

  return (
    <SidebarProvider>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Crimson+Pro:wght@400;600&display=swap');
          
          :root {
            --primary: 180 35% 55%;
            --primary-foreground: 0 0% 100%;
            --accent: 25 75% 65%;
            --destructive: 0 60% 60%;
          }
          
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          }
          
          h1, h2, h3, h4, h5, h6 {
            font-family: 'Crimson Pro', serif;
          }
          
          b, strong {
            font-weight: 700;
            color: inherit;
          }
        `}
      </style>
      <div className={`min-h-screen flex w-full ${nightMode ? 'bg-slate-900' : 'bg-stone-50'}`}>
        <Sidebar className={`border-r ${nightMode ? 'border-slate-700 bg-slate-800/95' : 'border-stone-200 bg-white/95'} backdrop-blur-sm`}>
          <SidebarHeader className={`border-b ${nightMode ? 'border-slate-700' : 'border-stone-200'} p-6`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-2xl">速</span>
              </div>
              <div>
                <h2 className="font-semibold text-xl text-slate-800" style={{fontFamily: "'Crimson Pro', serif"}}>
                  FastKanji
                </h2>
                <p className={`text-xs ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>速く学ぶ</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            <SidebarGroup>
              <SidebarGroupLabel className={`text-xs font-medium ${nightMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wider px-3 py-2`}>
                Study
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`${nightMode ? 'hover:bg-slate-700 hover:text-teal-400' : 'hover:bg-stone-100 hover:text-teal-700'} transition-all duration-200 rounded-lg mb-1 ${
                          location.pathname === item.url 
                            ? 'bg-teal-500 text-white shadow-sm' 
                            : nightMode ? 'text-slate-300' : 'text-slate-700'
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
              <SidebarGroupLabel className={`text-xs font-medium ${nightMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wider px-3 py-2`}>
                Tools
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {bottomNavigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`${nightMode ? 'hover:bg-slate-700 hover:text-teal-400' : 'hover:bg-stone-100 hover:text-teal-700'} transition-all duration-200 rounded-lg mb-1 ${
                          location.pathname === item.url 
                            ? 'bg-teal-500 text-white shadow-sm' 
                            : nightMode ? 'text-slate-300' : 'text-slate-700'
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

          <SidebarFooter className={`border-t ${nightMode ? 'border-slate-700' : 'border-stone-200'} p-4`}>
            <div className="flex items-center gap-3 px-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${nightMode ? 'bg-slate-700' : 'bg-stone-100'}`}>
                <span className={`${nightMode ? 'text-teal-400' : 'text-teal-600'} font-semibold text-sm`}>学</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm truncate ${nightMode ? 'text-slate-200' : 'text-slate-800'}`}>Learner</p>
                <p className={`text-xs truncate ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>頑張って</p>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className={`${nightMode ? 'bg-slate-800/95 border-slate-700' : 'bg-white/95 border-stone-200'} backdrop-blur-sm border-b px-6 py-4 md:hidden`}>
            <div className="flex items-center gap-4">
              <SidebarTrigger className={`${nightMode ? 'hover:bg-slate-700' : 'hover:bg-stone-100'} p-2 rounded-lg transition-colors duration-200`} />
              <h1 className="text-xl font-semibold text-slate-800" style={{fontFamily: "'Crimson Pro', serif"}}>
                FastKanji
              </h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
