import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";

const sizes = [
  { value: 20, label: "Quick", description: "~10 min session" },
  { value: 50, label: "Standard", description: "~25 min session" },
  { value: 100, label: "Extended", description: "~50 min session" },
  { value: 150, label: "Marathon", description: "~75 min session" },
];

export default function SessionSizeSelector({ sessionSize, onSelectSize }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {sizes.map((size) => (
        <motion.div
          key={size.value}
          whileTap={{ scale: 0.95 }}
        >
          <div
            onClick={() => onSelectSize(size.value)}
            className={`cursor-pointer transition-all p-3 rounded-xl border-2 text-center active:scale-98 ${
              sessionSize === size.value
                ? 'border-teal-500 bg-teal-50 dark:bg-teal-950 shadow-md'
                : 'border-border hover:border-teal-300'
            }`}
          >
            <p className="text-2xl font-bold text-teal-700 dark:text-teal-400">{size.value}</p>
            <p className="font-semibold text-foreground text-sm mt-1">{size.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{size.description}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}