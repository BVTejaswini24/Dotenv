import AnimatedCounter from "@/components/ui/AnimatedCounter";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { integralCF } from "@/styles/fonts";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import * as motion from "framer-motion/client";

const Header = () => {
  return (
    <header className="bg-[#F2F0F1] overflow-hidden">
      <div className="max-w-frame mx-auto grid grid-cols-1 md:grid-cols-2 pt-8 sm:pt-12 md:pt-16 lg:pt-24">
        {/* Text section */}
        <section className="px-4 xl:px-0 pb-8 md:pb-0">
          <motion.h1
            initial={{ y: "60px", opacity: 0, rotate: 5 }}
            whileInView={{ y: "0", opacity: 1, rotate: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className={cn([
              integralCF.className,
              "text-3xl sm:text-4xl md:text-4xl lg:text-5xl xl:text-[64px] xl:leading-[64px] mb-4 lg:mb-6",
            ])}
          >
            FIND CLOTHES THAT MATCH YOUR STYLE
          </motion.h1>
          <motion.p
            initial={{ y: "60px", opacity: 0 }}
            whileInView={{ y: "0", opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-black/60 text-sm sm:text-base mb-5 lg:mb-8 max-w-[545px]"
          >
            Browse through our diverse range of meticulously crafted garments,
            designed to bring out your individuality and cater to your sense of
            style.
          </motion.p>
          <motion.div
            initial={{ y: "60px", opacity: 0 }}
            whileInView={{ y: "0", opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            <Link
              href="/shop"
              className="w-full sm:w-52 mb-6 md:mb-10 inline-block text-center bg-black hover:bg-black/80 transition-all text-white px-10 py-4 rounded-full text-sm sm:text-base font-medium"
            >
              Shop Now
            </Link>
          </motion.div>
          <motion.div
            initial={{ y: "60px", opacity: 0 }}
            whileInView={{ y: "0", opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="flex flex-wrap items-center gap-y-4 gap-x-6 sm:gap-x-8 md:mb-16 lg:mb-24"
          >
            <div className="flex flex-col">
              <span className="font-bold text-2xl sm:text-3xl xl:text-[40px] xl:mb-1">
                <AnimatedCounter from={0} to={200} />+
              </span>
              <span className="text-xs sm:text-sm text-black/60 whitespace-nowrap">
                International Brands
              </span>
            </div>
            <Separator
              className="h-10 sm:h-12 w-px bg-black/10"
              orientation="vertical"
            />
            <div className="flex flex-col">
              <span className="font-bold text-2xl sm:text-3xl xl:text-[40px] xl:mb-1">
                <AnimatedCounter from={0} to={2000} />+
              </span>
              <span className="text-xs sm:text-sm text-black/60 whitespace-nowrap">
                High-Quality Products
              </span>
            </div>
            <Separator
              className="h-10 sm:h-12 w-px bg-black/10 hidden sm:block"
              orientation="vertical"
            />
            <div className="flex flex-col">
              <span className="font-bold text-2xl sm:text-3xl xl:text-[40px] xl:mb-1">
                <AnimatedCounter from={0} to={3000} />+
              </span>
              <span className="text-xs sm:text-sm text-black/60 whitespace-nowrap">
                Happy Customers
              </span>
            </div>
          </motion.div>
        </section>

        {/* Image section */}
        <motion.section
          initial={{ y: "60px", opacity: 0, rotate: 5 }}
          whileInView={{ y: "0", opacity: 1, rotate: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 1.8, duration: 0.8 }}
          className="relative min-h-[280px] sm:min-h-[360px] md:min-h-[380px] lg:min-h-[460px] xl:min-h-[530px] bg-cover bg-top xl:bg-[center_top_-1.6rem] bg-no-repeat bg-[url('/images/header-res-homepage.png')] md:bg-[url('/images/header-homepage.png')]"
        >
          <Image
            priority
            src="/icons/big-star.svg"
            height={104}
            width={104}
            alt="big star"
            className="absolute right-6 xl:right-0 top-8 md:top-12 w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 xl:w-[104px] xl:h-[104px] animate-[spin_4s_linear_infinite]"
          />
          <Image
            priority
            src="/icons/small-star.svg"
            height={56}
            width={56}
            alt="small star"
            className="absolute left-6 md:left-0 top-32 sm:top-52 md:top-40 lg:top-56 w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 xl:w-14 xl:h-14 animate-[spin_3s_linear_infinite]"
          />
        </motion.section>
      </div>
    </header>
  );
};

export default Header;
