import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import ModeSelector from "./ModeSelector";
import LevelSelector from "./LevelSelector";
import SessionSizeSelector from "./SessionSizeSelector";

export default function StudySettingsSheet({ 
  selectedLevel, 
  selectedMode, 
  sessionSize, 
  onSelectLevel, 
  onSelectMode, 
  onSelectSize,
  vocabularyCount,
  isPremium,
  onConfirm
}) {
  const [open, setOpen] = React.useState(false);

  const handleConfirm = () => {
    setOpen(false);
    onConfirm();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="text-sm text-muted-foreground">
          <Settings className="w-4 h-4 mr-2" />
          Change Settings
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl">Study Settings</SheetTitle>
        </SheetHeader>
        
        <div className="space-y-6 overflow-y-auto h-[calc(100%-8rem)] pb-6">
          <LevelSelector 
            selectedLevel={selectedLevel}
            onSelectLevel={onSelectLevel}
            vocabularyCount={vocabularyCount}
            isPremium={isPremium}
          />
          
          <ModeSelector 
            selectedMode={selectedMode}
            onSelectMode={onSelectMode}
          />

          <div>
            <h3 className="text-base font-semibold mb-3 text-foreground">
              Flash Study Size
            </h3>
            <SessionSizeSelector
              sessionSize={sessionSize}
              onSelectSize={onSelectSize}
            />
            <p className="text-xs mt-2 text-muted-foreground">
              SRS continues until all due cards reviewed
            </p>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t">
          <Button
            onClick={handleConfirm}
            className="w-full h-14 text-base font-semibold bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
          >
            Save Settings
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}