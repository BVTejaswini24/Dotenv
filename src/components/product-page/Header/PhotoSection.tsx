"use client";

import { Product } from "@/types/product.types";
import Image from "next/image";
import React, { useState } from "react";

const PhotoSection = ({ data }: { data: Product }) => {
  const [selected, setSelected] = useState<string>(data.srcUrl);

  return (
    <div className="flex flex-col-reverse lg:flex-row lg:gap-3.5">
      {/* Thumbnails */}
      {data?.gallery && data.gallery.length > 0 && (
        <div className="mt-3 flex w-full items-center justify-start gap-2.5 overflow-x-auto pb-1 scrollbar-none sm:justify-center lg:mt-0 lg:w-fit lg:flex-col lg:gap-3.5 lg:overflow-visible lg:pb-0">
          {data.gallery.map((photo, index) => (
            <button
              key={index}
              type="button"
              aria-label={`View ${data.title} image ${index + 1}`}
              aria-pressed={selected === photo}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-[13px] border-2 bg-[#F0EEED] transition-all sm:h-20 sm:w-20 lg:h-[106px] lg:w-[111px] lg:rounded-[20px] xl:h-[167px] xl:w-[152px] ${
                selected === photo ? "border-black" : "border-transparent"
              }`}
              onClick={() => setSelected(photo)}
            >
              <Image
                src={photo}
                width={152}
                height={167}
                sizes="(max-width: 1023px) 80px, 152px"
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                alt={`${data.title} view ${index + 1}`}
                priority
              />
            </button>
          ))}
        </div>
      )}

      {/* Main image */}
      <div className="flex aspect-square max-h-[500px] w-full items-center justify-center overflow-hidden rounded-[13px] bg-[#F0EEED] sm:rounded-[20px]">
        <Image
          src={selected}
          width={500}
          height={500}
          sizes="(max-width: 767px) 92vw, (max-width: 1023px) 48vw, 500px"
          className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
          alt={data.title}
          priority
          unoptimized
        />
      </div>
    </div>
  );
};

export default PhotoSection;
