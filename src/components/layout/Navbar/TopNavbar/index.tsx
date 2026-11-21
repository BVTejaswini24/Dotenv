"use client";

import { cn } from "@/lib/utils";
import { integralCF } from "@/styles/fonts";
import Link from "next/link";
import React from "react";
import { NavMenu } from "../navbar.types";
import { MenuList } from "./MenuList";
import {
  NavigationMenu,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { MenuItem } from "./MenuItem";
import ResTopNavbar from "./ResTopNavbar";
import CartBtn from "./CartBtn";
import WishlistBtn from "./WishlistBtn";
import AccountBtn from "./AccountBtn";
import SearchBar from "./SearchBar";
import MobileSearchSheet from "./MobileSearchSheet";

const data: NavMenu = [
  {
    id: 1,
    type: "MenuItem",
    label: "Shop",
    url: "/shop",
    children: [],
  },
  {
    id: 2,
    type: "MenuItem",
    label: "On Sale",
    url: "/shop?isOnSale=true",
    children: [],
  },
  {
    id: 3,
    type: "MenuItem",
    label: "New Arrivals",
    url: "/shop?isNew=true",
    children: [],
  },
];

const TopNavbar = () => {
  return (
    <nav className="sticky top-0 z-30 border-b border-black/5 bg-white/95 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-white/85">
      <div className="relative mx-auto flex max-w-frame items-center justify-between px-3.5 py-2.5 xs:px-4 sm:py-3 md:py-4 xl:px-0">
        {/* Left group: hamburger + logo */}
        <div className="flex min-w-0 shrink-0 items-center">
          <div className="mr-1.5 block md:hidden xs:mr-2">
            <ResTopNavbar data={data} />
          </div>
          <Link
            href="/"
            className={cn([
              integralCF.className,
              "mr-2 whitespace-nowrap text-[17px] leading-none tracking-tight xs:text-lg sm:text-xl md:mr-5 md:text-2xl lg:mr-10 lg:text-[28px] xl:text-[32px]",
            ])}
          >
            ShopSphere
          </Link>
        </div>

        {/* Center: desktop nav links */}
        <NavigationMenu className="mr-2 hidden shrink-0 md:flex lg:mr-7">
          <NavigationMenuList>
            {data.map((item) => (
              <React.Fragment key={item.id}>
                {item.type === "MenuItem" && (
                  <MenuItem label={item.label} url={item.url} />
                )}
                {item.type === "MenuList" && (
                  <MenuList data={item.children} label={item.label} />
                )}
              </React.Fragment>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        {/* Search bar: desktop only, flexible */}
        <div className="mr-3 hidden min-w-0 max-w-xs flex-1 md:flex lg:mr-6 lg:max-w-md xl:max-w-lg">
          <SearchBar />
        </div>

        {/* Right group: icons */}
        <div className="flex shrink-0 items-center gap-0 xs:gap-0.5 sm:gap-1">
          <MobileSearchSheet />
          {/* Wishlist also lives in the menu drawer on the narrowest screens */}
          <div className="hidden xs:block">
            <WishlistBtn />
          </div>
          <CartBtn />
          <AccountBtn />
        </div>
      </div>
    </nav>
  );
};

export default TopNavbar;
