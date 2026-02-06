import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

/**
 * Mobile-optimized Select that renders as a bottom drawer on mobile
 * and standard dropdown on desktop.
 */
export function MobileSelect({ value, onValueChange, children, placeholder, label }) {
  const [open, setOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Extract options from children
  const options = React.Children.toArray(children).map((child) => ({
    value: child.props.value,
    label: child.props.children,
  }));

  const selectedLabel = options.find((opt) => opt.value === value)?.label || placeholder;

  const handleSelect = (newValue) => {
    onValueChange(newValue);
    setOpen(false);
  };

  if (!isMobile) {
    // Desktop: use standard radix-ui Select
    const { Select, SelectTrigger, SelectValue, SelectContent } = require("@/components/ui/select");
    return (
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    );
  }

  // Mobile: use Drawer
  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full justify-between"
      >
        <span className={value ? '' : 'text-muted-foreground'}>
          {selectedLabel}
        </span>
        <span className="ml-2">▼</span>
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{label || placeholder}</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-lg border transition-colors",
                  value === option.value
                    ? "bg-teal-50 dark:bg-teal-950 border-teal-500 text-teal-700 dark:text-teal-300"
                    : "bg-card border-border hover:bg-accent"
                )}
              >
                <span className="font-medium">{option.label}</span>
                {value === option.value && <Check className="w-5 h-5" />}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}