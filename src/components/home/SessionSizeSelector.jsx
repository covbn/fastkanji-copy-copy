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
    <div className="space-y-3">
      <Label className="text-base font-semibold text-foreground">Session Size</Label>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {sizes.map((size) => (
          <motion.div
            key={size.value}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Card
              onClick={() => onSelectSize(size.value)}
              className={`cursor-pointer transition-all duration-300 border ${
                sessionSize === size.value
                  ? 'border-2 border-teal-500 bg-teal-50 dark:bg-teal-950 shadow-md'
                  : 'border-border hover:border-teal-300 hover:shadow-sm'
              }`}
            >
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-teal-700 dark:text-teal-400 mb-1">{size.value}</p>
                <p className="font-semibold text-foreground text-sm">{size.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{size.description}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}