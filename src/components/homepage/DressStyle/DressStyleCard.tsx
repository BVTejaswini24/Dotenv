import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import React from "react";

type DressStyleCardProps = {
  title: string;
  url: string;
  /** src path for the background image */
  imageSrc: string;
  /** Natural image width (used by Next.js Image) */
  imageWidth: number;
  /** Natural image height (used by Next.js Image) */
  imageHeight: number;
  /** Tailwind object-position override e.g. "object-right" */
  imagePosition?: string;
  className?: string;
};

const DressStyleCard = ({
  title,
  url,
  imageSrc,
  imageWidth,
  imageHeight,
  imagePosition = "object-right",
  className,
}: DressStyleCardProps) => {
  return (
    <Link
      href={url}
      className={cn(
        "relative w-full overflow-hidden rounded-[20px] bg-white",
        "flex items-start",
        "transition-transform hover:scale-[1.01] active:scale-100",
        className
      )}
    >
      {/* Title — always top-left, above the image */}
      <span
        className={cn(
          "relative z-10 font-bold leading-tight",
          "text-base xs:text-lg sm:text-2xl md:text-[28px] lg:text-4xl",
          "pl-3.5 pt-3.5 sm:pl-5 sm:pt-5 md:pl-9 md:pt-[25px]"
        )}
      >
        {title}
      </span>

      {/* Background image — absolutely fills the card */}
      <Image
        src={imageSrc}
        alt={title}
        fill
        sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
        className={cn("object-cover", imagePosition)}
        priority
      />
    </Link>
  );
};

export default DressStyleCard;
