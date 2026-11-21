import React from "react";
import * as motion from "framer-motion/client";
import { cn } from "@/lib/utils";
import { integralCF } from "@/styles/fonts";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import ProductCard from "./ProductCard";
import { Product } from "@/types/product.types";
import Link from "next/link";

type ProductListSecProps = {
  title: string;
  data: Product[];
  viewAllLink?: string;
};

const ProductListSec = ({ title, data, viewAllLink }: ProductListSecProps) => {
  return (
    <section className="mx-auto max-w-frame overflow-hidden text-center">
      <motion.h2
        initial={{ y: "60px", opacity: 0 }}
        whileInView={{ y: "0", opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className={cn([
          integralCF.className,
          "mb-5 px-4 text-[22px] leading-tight xs:text-2xl sm:mb-8 sm:text-[32px] md:mb-14 md:text-5xl capitalize xl:px-0",
        ])}
      >
        {title}
      </motion.h2>
      <motion.div
        initial={{ y: "60px", opacity: 0 }}
        whileInView={{ y: "0", opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.6, duration: 0.6 }}
      >
        {/* Mobile: balanced two-column grid instead of a squeezed carousel */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-7 px-4 md:hidden">
          {data.map((product) => (
            <ProductCard key={product.id} data={product} />
          ))}
        </div>

        {/* Tablet and desktop: the original carousel */}
        <div className="hidden md:block">
          <Carousel
            opts={{
              align: "start",
              dragFree: true,
            }}
            className="mb-6 w-full md:mb-9"
          >
            <CarouselContent className="ml-4 mr-4 xl:ml-0 xl:mr-0">
              {data.map((product) => (
                <CarouselItem
                  key={product.id}
                  className="basis-[220px] pl-3 first:pl-0 sm:pl-4 md:basis-[260px] lg:basis-[295px] xl:pl-5"
                >
                  <ProductCard data={product} />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>

        {viewAllLink && (
          <div className="w-full px-4 text-center sm:px-0">
            <Link
              href={viewAllLink}
              className="mt-6 inline-block w-full rounded-full border border-black/10 px-10 py-3.5 text-sm font-medium text-black transition-all hover:bg-black hover:text-white sm:mt-0 sm:w-[218px] sm:py-4 sm:text-base"
            >
              View All
            </Link>
          </div>
        )}
      </motion.div>
    </section>
  );
};

export default ProductListSec;
