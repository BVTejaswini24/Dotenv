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
        <div className="flex lg:flex-col gap-3 lg:gap-3.5 w-full lg:w-fit items-center justify-center mt-3 lg:mt-0">
          {data.gallery.map((photo, index) => (
            <button
              key={index}
              type="button"
              className={`bg-[#F0EEED] rounded-[13px] lg:rounded-[20px] w-16 h-16 sm:w-20 sm:h-20 lg:w-[111px] lg:h-[106px] xl:w-[152px] xl:h-[167px] overflow-hidden transition-all border-2 ${selected === photo ? "border-black" : "border-transparent"}`}
              onClick={() => setSelected(photo)}
            >
              <Image
                src={photo}
                width={152}
                height={167}
                className="w-full h-full object-cover hover:scale-110 transition-all duration-500"
                alt={`${data.title} view ${index + 1}`}
                priority
              />
            </button>
          ))}
        </div>
      )}

      {/* Main image */}
      <div className="flex items-center justify-center bg-[#F0EEED] rounded-[13px] sm:rounded-[20px] w-full overflow-hidden aspect-square max-h-[500px]">
        <Image
          src={selected}
          width={500}
          height={500}
          className="w-full h-full object-cover hover:scale-105 transition-all duration-500"
          alt={data.title}
          priority
          unoptimized
        />
      </div>
    </div>
  );
};

export default PhotoSection;
