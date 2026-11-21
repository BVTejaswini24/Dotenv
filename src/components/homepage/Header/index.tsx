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
    <header className="overflow-hidden bg-[#F2F0F1]">
      <div className="mx-auto grid max-w-frame grid-cols-1 pt-7 xs:pt-8 sm:pt-12 md:grid-cols-2 md:pt-16 lg:pt-24">
        {/* Text section */}
        <section className="px-4 pb-8 md:pb-0 xl:px-0">
          <motion.h1
            initial={{ y: "60px", opacity: 0, rotate: 5 }}
            whileInView={{ y: "0", opacity: 1, rotate: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className={cn([
              integralCF.className,
              "mb-3 text-[30px] leading-[1.05] xs:text-[34px] sm:text-4xl md:mb-4 md:text-4xl lg:mb-6 lg:text-5xl xl:text-[64px] xl:leading-[64px]",
            ])}
          >
            FIND CLOTHES THAT MATCH YOUR STYLE
          </motion.h1>
          <motion.p
            initial={{ y: "60px", opacity: 0 }}
            whileInView={{ y: "0", opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mb-5 max-w-[545px] text-sm leading-relaxed text-black/60 xs:text-[15px] sm:mb-6 sm:text-base lg:mb-8"
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
              className="mb-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-black px-10 text-sm font-medium text-white transition-all hover:bg-black/80 sm:mb-8 sm:w-52 sm:text-base md:mb-10"
            >
              Shop Now
            </Link>
          </motion.div>
          <motion.div
            initial={{ y: "60px", opacity: 0 }}
            whileInView={{ y: "0", opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="flex flex-wrap items-center gap-x-5 gap-y-4 xs:gap-x-6 sm:gap-x-8 md:mb-16 lg:mb-24"
          >
            <div className="flex min-w-0 flex-col">
              <span className="text-xl font-bold xs:text-2xl sm:text-3xl xl:mb-1 xl:text-[40px]">
                <AnimatedCounter from={0} to={200} />+
              </span>
              <span className="whitespace-nowrap text-[11px] text-black/60 xs:text-xs sm:text-sm">
                International Brands
              </span>
            </div>
            <Separator
              className="hidden h-10 w-px bg-black/10 sm:block sm:h-12"
              orientation="vertical"
            />
            <div className="flex min-w-0 flex-col">
              <span className="text-xl font-bold xs:text-2xl sm:text-3xl xl:mb-1 xl:text-[40px]">
                <AnimatedCounter from={0} to={2000} />+
              </span>
              <span className="whitespace-nowrap text-[11px] text-black/60 xs:text-xs sm:text-sm">
                High-Quality Products
              </span>
            </div>
            <Separator
              className="hidden h-10 w-px bg-black/10 sm:block sm:h-12"
              orientation="vertical"
            />
            <div className="flex min-w-0 flex-col">
              <span className="text-xl font-bold xs:text-2xl sm:text-3xl xl:mb-1 xl:text-[40px]">
                <AnimatedCounter from={0} to={3000} />+
              </span>
              <span className="whitespace-nowrap text-[11px] text-black/60 xs:text-xs sm:text-sm">
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
          className="relative min-h-[300px] bg-[url('/images/header-res-homepage.png')] bg-cover bg-top bg-no-repeat xs:min-h-[340px] sm:min-h-[360px] md:min-h-[380px] md:bg-[url('/images/header-homepage.png')] lg:min-h-[460px] xl:min-h-[530px] xl:bg-[center_top_-1.6rem]"
        >
          <Image
            priority
            src="/icons/big-star.svg"
            height={104}
            width={104}
            alt="big star"
            className="absolute right-5 top-7 h-12 w-12 animate-[spin_4s_linear_infinite] xs:right-6 xs:top-8 xs:h-14 xs:w-14 sm:h-16 sm:w-16 md:top-12 lg:h-20 lg:w-20 xl:right-0 xl:h-[104px] xl:w-[104px]"
          />
          <Image
            priority
            src="/icons/small-star.svg"
            height={56}
            width={56}
            alt="small star"
            className="absolute left-5 top-32 h-9 w-9 animate-[spin_3s_linear_infinite] xs:left-6 xs:top-36 sm:top-52 sm:h-10 sm:w-10 md:left-0 md:top-40 md:h-12 md:w-12 lg:top-56 xl:h-14 xl:w-14"
          />
        </motion.section>
      </div>
    </header>
  );
};

export default Header;
