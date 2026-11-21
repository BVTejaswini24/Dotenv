import { cn } from "@/lib/utils";
import { integralCF } from "@/styles/fonts";
import React from "react";
import * as motion from "framer-motion/client";
import DressStyleCard from "./DressStyleCard";

const DressStyle = () => {
  return (
    <div className="px-4 xl:px-0">
      <section className="mx-auto max-w-frame rounded-2xl bg-[#F0F0F0] px-3.5 pb-5 pt-7 xs:px-4 xs:pb-6 xs:pt-8 sm:rounded-[40px] sm:px-6 sm:pb-8 sm:pt-10 md:px-[70px] md:pb-[70px] md:pt-[70px]">

        {/* ── Heading ── */}
        <motion.h2
          initial={{ y: "60px", opacity: 0 }}
          whileInView={{ y: "0", opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className={cn(
            integralCF.className,
            "text-xl xs:text-2xl sm:text-[32px] md:text-5xl",
            "leading-tight text-center capitalize",
            "mb-5 sm:mb-8 md:mb-14"
          )}
        >
          BROWSE BY DRESS STYLE
        </motion.h2>

        {/* ── Row 1: Casual + Formal ── */}
        <motion.div
          initial={{ y: "60px", opacity: 0 }}
          whileInView={{ y: "0", opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="grid grid-cols-2 md:flex md:flex-row gap-3 sm:gap-4 mb-3 sm:mb-4"
        >
          {/* Casual */}
          <DressStyleCard
            title="Casual"
            url="/shop?style=Casual"
            imageSrc="/images/dress-style-1.png"
            imageWidth={407}
            imageHeight={289}
            imagePosition="object-right object-top"
            className={cn(
              /* mobile: equal half-width, fixed height */
              "h-[136px] xs:h-[150px] sm:h-[180px]",
              /* desktop: original narrow proportions */
              "md:h-[289px] md:max-w-[260px] lg:max-w-[360px] xl:max-w-[407px] md:flex-shrink-0"
            )}
          />
          {/* Formal */}
          <DressStyleCard
            title="Formal"
            url="/shop?style=Formal"
            imageSrc="/images/dress-style-2.png"
            imageWidth={684}
            imageHeight={289}
            imagePosition="object-right object-top"
            className={cn(
              "h-[136px] xs:h-[150px] sm:h-[180px]",
              "md:h-[289px] md:flex-1"
            )}
          />
        </motion.div>

        {/* ── Row 2: Party + Gym ── */}
        <motion.div
          initial={{ y: "60px", opacity: 0 }}
          whileInView={{ y: "0", opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="grid grid-cols-2 md:flex md:flex-row gap-3 sm:gap-4"
        >
          {/* Party */}
          <DressStyleCard
            title="Party"
            url="/shop?style=Party"
            imageSrc="/images/dress-style-3.png"
            imageWidth={642}
            imageHeight={289}
            imagePosition="object-right object-top"
            className={cn(
              "h-[136px] xs:h-[150px] sm:h-[180px]",
              "md:h-[289px] md:flex-1"
            )}
          />
          {/* Gym */}
          <DressStyleCard
            title="Gym"
            url="/shop?style=Gym"
            imageSrc="/images/dress-style-4.png"
            imageWidth={354}
            imageHeight={289}
            imagePosition="object-right object-top"
            className={cn(
              "h-[136px] xs:h-[150px] sm:h-[180px]",
              "md:h-[289px] md:max-w-[260px] lg:max-w-[360px] xl:max-w-[407px] md:flex-shrink-0"
            )}
          />
        </motion.div>

      </section>
    </div>
  );
};

export default DressStyle;
