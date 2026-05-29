import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * AiTek Solutions logo.
 *
 * The brand logo uses dark charcoal + gray text, which is invisible on the
 * app's dark background — so on dark surfaces we render it inside a light
 * "plate". Use `plate={false}` on light backgrounds (PDF/email use the raw
 * asset directly instead of this component).
 */
export function Logo({
  className,
  width = 150,
  plate = true,
  priority = false,
}: {
  className?: string;
  width?: number;
  plate?: boolean;
  priority?: boolean;
}) {
  const height = Math.round((width * 282) / 946); // preserve aspect ratio

  const img = (
    <Image
      src="/logo.png"
      alt="AiTek Solutions"
      width={width}
      height={height}
      priority={priority}
      className="h-auto w-full object-contain"
    />
  );

  if (!plate) {
    return (
      <div className={cn("inline-flex", className)} style={{ width }}>
        {img}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-white px-3 py-2 shadow-sm",
        className
      )}
      style={{ width: width + 24 }}
    >
      {img}
    </div>
  );
}

/** Just the orbit mark (square), works on any background. */
export function LogoMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/logo-mark.png"
      alt="AiTek Solutions"
      width={size}
      height={size}
      className={cn("object-contain", className)}
    />
  );
}
