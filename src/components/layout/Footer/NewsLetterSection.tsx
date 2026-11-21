"use client";

import { Button } from "@/components/ui/button";
import InputGroup from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { integralCF } from "@/styles/fonts";
import Image from "next/image";
import React, { useState } from "react";
import { toast } from "sonner";

const NewsLetterSection = () => {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = email.trim();

    if (!trimmed) {
      toast.error("Please enter your email address.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmed)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    toast.success("You've been subscribed to our newsletter!");
    setEmail("");
  };

  return (
    <div className="relative mx-auto grid max-w-frame grid-cols-1 gap-5 rounded-2xl bg-black px-4 py-7 xs:px-5 xs:py-8 sm:gap-6 sm:rounded-[20px] sm:px-8 md:grid-cols-2 md:gap-0 md:px-16 md:py-11">
      <p
        className={cn([
          integralCF.className,
          "mb-0 text-[22px] font-bold leading-tight text-white xs:text-2xl sm:text-[32px] md:text-[40px]",
        ])}
      >
        STAY UP TO DATE ABOUT OUR LATEST OFFERS
      </p>
      <div className="flex items-center">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col w-full max-w-[349px] mx-auto"
        >
          <InputGroup className="flex bg-white mb-[14px]">
            <InputGroup.Text>
              <Image
                priority
                src="/icons/envelope.svg"
                height={20}
                width={20}
                alt="email"
                className="min-w-5 min-h-5"
              />
            </InputGroup.Text>
            <InputGroup.Input
              type="email"
              name="email"
              placeholder="Enter your email address"
              className="bg-transparent placeholder:text-black/40 placeholder:text-sm sm:placeholder:text-base"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </InputGroup>
          <Button
            variant="secondary"
            className="text-sm sm:text-base font-medium bg-white h-12 rounded-full px-4 py-3"
            aria-label="Subscribe to Newsletter"
            type="submit"
          >
            Subscribe to Newsletter
          </Button>
        </form>
      </div>
    </div>
  );
};

export default NewsLetterSection;
