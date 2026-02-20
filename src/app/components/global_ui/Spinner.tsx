import { FC } from "react";

interface SpinnerProps {
  type: "spin" | "bounce" | "double Spinner";
  color?: string;
  size?: number;
  duration?: number;
  delayStep?: number;
}

export const Spinner: FC<SpinnerProps> = ({
  type,
  color,
  size = 24,
  duration = 1,
  delayStep = 0.2,
}) => {
  if (type === "spin") {
    return (
      <div
        style={{
          width: size + "px",
          height: size + "px",
          borderColor: color || "white",
          borderTopColor: "transparent",
          borderStyle: "solid",
          borderWidth: "4px",
          animationDuration: `${duration}s`,
        }}
        className="animate-spin rounded-full inline-block box-border"
      />
    );
  } else if (type === "double Spinner") {
    return (
      <div className="relative inline-block">
        {/* Outer Spinner */}
        <div
          style={{
            width: size + "px",
            height: size + "px",
            borderColor: color || "white",
            borderTopColor: "transparent",
            borderStyle: "solid",
            borderWidth: "3px",
            animationDuration: `${duration}s`,
          }}
          className="animate-spin rounded-full box-border"
        />

        {/* Inner Spinner (reverse) */}
        <div
          style={{
            width: size * 0.6 + "px",
            height: size * 0.6 + "px",
            borderColor: color || "white",
            borderTopColor: "transparent",
            borderStyle: "solid",
            borderWidth: "3px",
            animationDuration: `${duration}s`,
          }}
          className="animate-reverse-spin rounded-full box-border absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        />
      </div>
    );
  }

  // Bounce Loader
  else {
    return (
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: size + "px",
              height: size + "px",
              backgroundColor: color || "white",
              animationDuration: `${duration}s`,
              animationDelay: `${i * delayStep}s`,
            }}
            className="animate-dot-bounce rounded-full"
          />
        ))}
      </div>
    );
  }
};
