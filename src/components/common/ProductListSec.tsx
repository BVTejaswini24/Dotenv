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
    <section className="max-w-frame mx-auto text-center overflow-hidden">
      <motion.h2
        initial={{ y: "60px", opacity: 0 }}
        whileInView={{ y: "0", opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className={cn([
          integralCF.className,
          "text-2xl sm:text-[32px] md:text-5xl mb-6 md:mb-14 capitalize px-4 xl:px-0",
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
        <Carousel
          opts={{
            align: "start",
            dragFree: true,
          }}
          className="w-full mb-6 md:mb-9"
        >
          <CarouselContent className="ml-4 xl:ml-0 mr-4 xl:mr-0">
            {data.map((product) => (
              <CarouselItem
                key={product.id}
                className="basis-[160px] xs:basis-[185px] sm:basis-[220px] md:basis-[260px] lg:basis-[295px] pl-3 sm:pl-4 xl:pl-5 first:pl-0"
              >
                <ProductCard data={product} />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        {viewAllLink && (
          <div className="w-full px-4 sm:px-0 text-center">
            <Link
              href={viewAllLink}
              className="inline-block w-full sm:w-[218px] px-10 py-3.5 sm:py-4 border rounded-full hover:bg-black hover:text-white text-black transition-all font-medium text-sm sm:text-base border-black/10"
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
