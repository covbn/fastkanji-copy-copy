import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function MobileHeader({ title }) {
  const navigate = useNavigate();

  return (
    <div className="md:hidden sticky top-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-b border-border z-40" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center gap-3 px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(createPageUrl('Home'))}
          className="select-none"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      </div>
    </div>
  );
}