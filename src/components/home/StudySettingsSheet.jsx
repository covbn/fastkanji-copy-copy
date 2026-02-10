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
  onConfirm,
  onStartFlash,
  onStartSRS
}) {
  const [open, setOpen] = React.useState(false);
  const [tempLevel, setTempLevel] = React.useState(selectedLevel);
  const [tempMode, setTempMode] = React.useState(selectedMode);
  const [tempSize, setTempSize] = React.useState(sessionSize);
  const [startType, setStartType] = React.useState('flash');

  // Sync with parent when opened
  React.useEffect(() => {
    if (open) {
      setTempLevel(selectedLevel);
      setTempMode(selectedMode);
      setTempSize(sessionSize);
    }
  }, [open, selectedLevel, selectedMode, sessionSize]);

  const handleSaveAndStart = () => {
    onSelectLevel(tempLevel);
    onSelectMode(tempMode);
    onSelectSize(tempSize);
    setOpen(false);
    
    // Small delay to let sheet close smoothly
    setTimeout(() => {
      if (startType === 'flash') {
        onStartFlash();
      } else {
        onStartSRS();
      }
    }, 100);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground">
          <Settings className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl">Study Settings</SheetTitle>
        </SheetHeader>
        
        <div className="space-y-6 overflow-y-auto h-[calc(100%-10rem)] pb-6">
          <LevelSelector 
            selectedLevel={tempLevel}
            onSelectLevel={setTempLevel}
            vocabularyCount={vocabularyCount}
            isPremium={isPremium}
          />
          
          <ModeSelector 
            selectedMode={tempMode}
            onSelectMode={setTempMode}
          />

          <div>
            <h3 className="text-base font-semibold mb-3 text-foreground">
              Flash Study Size
            </h3>
            <SessionSizeSelector
              sessionSize={tempSize}
              onSelectSize={setTempSize}
            />
            <p className="text-xs mt-2 text-muted-foreground">
              SRS continues until all due cards reviewed
            </p>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t space-y-2">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Button
              variant={startType === 'flash' ? 'default' : 'outline'}
              onClick={() => setStartType('flash')}
              className={startType === 'flash' ? 'bg-teal-500 hover:bg-teal-600' : ''}
            >
              Flash Study
            </Button>
            <Button
              variant={startType === 'srs' ? 'default' : 'outline'}
              onClick={() => setStartType('srs')}
              className={startType === 'srs' ? 'bg-teal-500 hover:bg-teal-600' : ''}
            >
              SRS
            </Button>
          </div>
          <Button
            onClick={handleSaveAndStart}
            className="w-full h-14 text-base font-semibold bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white rounded-xl shadow-lg"
          >
            Save & Start
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}