"use client";

// framer-motion is loaded on demand — not part of the initial route JS.
// The null fallback is intentional: the animation has no meaningful skeleton.
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useUIStore } from "@/app/stores/useUIStore";
import { Sparkles } from "lucide-react";

const MotionDiv = dynamic(() => import("framer-motion").then((mod) => mod.motion.div), {
  ssr: false,
});
const AnimatePresence = dynamic(() => import("framer-motion").then((mod) => mod.AnimatePresence), {
  ssr: false,
});

interface XPGainAnimationProps {
  amount: number;
  show: boolean;
  onComplete?: () => void;
  position?: "top" | "center" | "bottom";
}

export function XPGainAnimation({
  amount,
  show,
  onComplete,
  position = "top",
}: XPGainAnimationProps) {
  const [isVisible, setIsVisible] = useState(show);
  const reducedMotion = useUIStore((state) => state.reducedMotion);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  const positionClasses = {
    top: "top-4",
    center: "top-1/2 -translate-y-1/2",
    bottom: "bottom-4",
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.5, y: 20 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: -20 }}
        <MotionDiv
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className={`fixed left-1/2 ${positionClasses[position]} z-50 -translate-x-1/2`}
        >
          <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3 shadow-lg">
            <motion.div
              animate={reducedMotion ? {} : { rotate: [0, 360] }}
              transition={reducedMotion ? {} : { duration: 1, repeat: Infinity, ease: "linear" }}
            <MotionDiv
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles size={20} className="text-yellow-300" />
            </MotionDiv>
            <span className="text-lg font-bold text-white">+{amount} XP</span>
          </div>
        </MotionDiv>
      )}
    </AnimatePresence>
  );
}
