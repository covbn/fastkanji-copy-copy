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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
      {sizes.map((size) => (
        <motion.div
          key={size.value}
          whileTap={{ scale: 0.95 }}
        >
          <div
            onClick={() => onSelectSize(size.value)}
            className={`cursor-pointer transition-all p-1.5 rounded border text-center ${
              sessionSize === size.value
                ? 'border-teal-500 bg-teal-50 dark:bg-teal-950'
                : 'border-border hover:border-teal-300'
            }`}
          >
            <p className="text-lg font-bold text-teal-700 dark:text-teal-400">{size.value}</p>
            <p className="font-semibold text-foreground text-[10px] leading-tight">{size.label}</p>
            <p className="text-[9px] text-muted-foreground leading-tight">{size.description}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}