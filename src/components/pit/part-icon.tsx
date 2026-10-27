import type { Part } from "@/lib/pit/catalog";

/** Tier colors for badges and icon tint. */
export const TIER_STYLE: Record<Part["tier"], { badge: string; tint: string; label: string }> = {
  stock: { badge: "bg-white/10 text-muted", tint: "#9a948a", label: "Stock" },
  sport: { badge: "bg-[#3c8f78]/25 text-[#7fd4b6]", tint: "#5fbf9c", label: "Sport" },
  pro: { badge: "bg-[#3d8fe8]/25 text-[#8cc0ff]", tint: "#6aa8f0", label: "Pro" },
  super: { badge: "bg-[#a46bff]/25 text-[#cfa8ff]", tint: "#b98aff", label: "Super" },
  championship: { badge: "bg-amber/25 text-amber", tint: "#f0a202", label: "Title" },
};

type Shape =
  | "saw" | "drum" | "disc" | "hammer" | "wedge" | "claw" | "flail" | "lance" | "flame" | "tesla" | "blade" | "launcher"
  | "wheel" | "tread" | "caster" | "hover" | "rocket" | "anchor"
  | "shield" | "spike" | "cage" | "field"
  | "chassis" | "gadget" | "chip";

/** A drawing for each family, falling back to the slot's general shape. */
function shapeOf(part: Part): Shape {
  const f = part.family;
  if (part.slot === "weapon") {
    if (["saw", "chainsaw"].includes(f)) return "saw";
    if (f === "drum") return "drum";
    if (f === "disc") return "disc";
    if (["hammer", "carver", "axe"].includes(f)) return "hammer";
    if (f === "wedge") return "wedge";
    if (["claw", "bones"].includes(f)) return "claw";
    if (f === "flail") return "flail";
    if (["piston", "broom"].includes(f)) return "lance";
    if (f === "flame") return "flame";
    if (f === "tesla") return "tesla";
    if (["launcher", "yamcannon"].includes(f)) return "launcher";
    return "blade";
  }
  if (part.slot === "drive") {
    if (["treads", "anchor"].includes(f)) return f === "anchor" ? "anchor" : "tread";
    if (["omni", "swerve"].includes(f)) return "caster";
    if (["air"].includes(f)) return "hover";
    if (f === "rocket") return "rocket";
    return "wheel";
  }
  if (part.slot === "armor") {
    if (f === "spike") return "spike";
    if (f === "cage") return "cage";
    if (f === "magnet") return "field";
    return "shield";
  }
  if (part.slot === "chassis") return f === "hover" ? "hover" : "chassis";
  if (part.slot === "brain") return "chip";
  return "gadget";
}

function Drawing({ shape }: { shape: Shape }) {
  switch (shape) {
    case "saw":
    case "drum":
    case "disc": {
      const teeth = shape === "drum" ? 6 : shape === "disc" ? 3 : 12;
      return (
        <g>
          {Array.from({ length: teeth }, (_, i) => (
            <path key={i} d="M32 6 L36 14 L28 14 Z" transform={`rotate(${(360 / teeth) * i} 32 32)`} />
          ))}
          <circle cx="32" cy="32" r={shape === "drum" ? 15 : 18} />
          <circle cx="32" cy="32" r="4" className="hole" />
        </g>
      );
    }
    case "hammer":
      return (
        <g>
          <rect x="29" y="22" width="6" height="34" rx="2" />
          <rect x="16" y="10" width="32" height="14" rx="3" />
        </g>
      );
    case "wedge":
      return <path d="M6 50 L58 50 L58 22 Z" />;
    case "claw":
      return (
        <g>
          <rect x="28" y="34" width="8" height="22" rx="2" />
          <path d="M32 36 C14 34 10 18 18 8 C20 18 26 24 32 26 C38 24 44 18 46 8 C54 18 50 34 32 36 Z" />
        </g>
      );
    case "flail":
      return (
        <g>
          <rect x="8" y="44" width="20" height="6" rx="2" />
          <path d="M26 46 L40 30" strokeWidth="3" className="line" />
          <circle cx="44" cy="24" r="10" />
          <path d="M44 10 L46 14 L42 14 Z M58 24 L54 26 L54 22 Z M30 24 L34 22 L34 26 Z" />
        </g>
      );
    case "lance":
      return (
        <g>
          <rect x="6" y="28" width="30" height="8" rx="2" />
          <path d="M34 22 L60 32 L34 42 Z" />
        </g>
      );
    case "flame":
      return <path d="M32 58 C16 56 12 40 22 28 C22 36 26 38 28 38 C24 26 30 14 38 6 C38 18 52 26 50 42 C49 52 42 58 32 58 Z" />;
    case "tesla":
      return (
        <g>
          <rect x="26" y="34" width="12" height="22" rx="2" />
          <circle cx="32" cy="24" r="10" />
          <path d="M44 12 L52 8 L48 18 L56 16 L46 28" strokeWidth="2.5" className="line" />
        </g>
      );
    case "launcher":
      return (
        <g>
          <rect x="8" y="34" width="40" height="12" rx="3" transform="rotate(-25 28 40)" />
          <circle cx="50" cy="16" r="7" />
        </g>
      );
    case "blade":
      return <path d="M8 52 L48 8 L56 16 L16 56 Z M8 52 L4 60 L12 56 Z" />;
    case "wheel":
      return (
        <g>
          <circle cx="32" cy="32" r="24" />
          <circle cx="32" cy="32" r="12" className="hole" />
          <circle cx="32" cy="32" r="4" />
        </g>
      );
    case "tread":
      return (
        <g>
          <rect x="4" y="20" width="56" height="26" rx="13" />
          <circle cx="17" cy="33" r="7" className="hole" />
          <circle cx="32" cy="33" r="7" className="hole" />
          <circle cx="47" cy="33" r="7" className="hole" />
        </g>
      );
    case "caster":
      return (
        <g>
          <circle cx="32" cy="32" r="22" />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <ellipse key={a} cx="32" cy="14" rx="4" ry="6" className="hole" transform={`rotate(${a} 32 32)`} />
          ))}
        </g>
      );
    case "hover":
      return (
        <g>
          <rect x="8" y="22" width="48" height="14" rx="7" />
          <path d="M12 42 Q20 48 28 42 Q36 48 44 42 Q52 48 56 44" strokeWidth="3" className="line" />
        </g>
      );
    case "rocket":
      return (
        <g>
          <path d="M14 22 L46 22 L58 32 L46 42 L14 42 Z" />
          <path d="M14 26 L4 22 L8 32 L4 42 L14 38 Z" className="hole" />
        </g>
      );
    case "anchor":
      return (
        <g>
          <rect x="29" y="8" width="6" height="40" rx="2" />
          <path d="M10 38 C12 54 52 54 54 38 L48 40 C46 48 18 48 16 40 Z" />
          <circle cx="32" cy="10" r="6" />
        </g>
      );
    case "shield":
      return <path d="M32 4 L54 12 L54 30 C54 46 44 54 32 60 C20 54 10 46 10 30 L10 12 Z" />;
    case "spike":
      return (
        <g>
          <path d="M32 10 L52 16 L52 32 C52 44 44 50 32 56 C20 50 12 44 12 32 L12 16 Z" />
          <path d="M32 2 L35 10 L29 10 Z M56 14 L52 20 L50 13 Z M8 14 L14 13 L12 20 Z" />
        </g>
      );
    case "cage":
      return (
        <g className="open">
          <rect x="10" y="12" width="44" height="40" rx="4" strokeWidth="4" className="line" />
          <path d="M24 12 V52 M40 12 V52 M10 32 H54" strokeWidth="3" className="line" />
        </g>
      );
    case "field":
      return (
        <g>
          <path d="M18 10 V34 A14 14 0 0 0 46 34 V10 H38 V34 A6 6 0 0 1 26 34 V10 Z" />
          <path d="M8 50 Q32 64 56 50" strokeWidth="2.5" className="line" />
        </g>
      );
    case "chassis":
      return (
        <g>
          <path d="M6 40 L14 24 L50 24 L58 40 Z" />
          <rect x="18" y="30" width="12" height="6" className="hole" />
          <circle cx="16" cy="44" r="7" />
          <circle cx="48" cy="44" r="7" />
        </g>
      );
    case "chip":
      return (
        <g>
          <rect x="16" y="16" width="32" height="32" rx="4" />
          <rect x="24" y="24" width="16" height="16" className="hole" />
          {[20, 28, 36, 44].map((p) => (
            <path key={p} d={`M${p} 8 V16 M${p} 48 V56 M8 ${p} H16 M48 ${p} H56`} strokeWidth="3" className="line" />
          ))}
        </g>
      );
    default:
      return (
        <g>
          <circle cx="32" cy="32" r="16" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <rect key={a} x="29" y="8" width="6" height="10" transform={`rotate(${a} 32 32)`} />
          ))}
          <circle cx="32" cy="32" r="6" className="hole" />
        </g>
      );
  }
}

/** A small drawing of the part, tinted by tier. Decorative: the name sits beside it. */
export function PartIcon({ part, className = "h-14 w-14" }: { part: Part; className?: string }) {
  const tint = TIER_STYLE[part.tier].tint;
  return (
    <svg viewBox="0 0 64 64" className={`part-icon shrink-0 ${className}`} aria-hidden style={{ ["--tint" as string]: tint }}>
      <rect x="0" y="0" width="64" height="64" rx="10" className="plate" />
      <g className="art">
        <Drawing shape={shapeOf(part)} />
      </g>
    </svg>
  );
}
