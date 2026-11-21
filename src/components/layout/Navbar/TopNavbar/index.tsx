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
    <nav className="sticky top-0 bg-white z-20 border-b border-black/5 shadow-sm">
      <div className="flex relative max-w-frame mx-auto items-center justify-between py-3 sm:py-4 md:py-5 px-4 xl:px-0">
        {/* Left group: hamburger + logo */}
        <div className="flex items-center min-w-0 shrink-0">
          <div className="block md:hidden mr-2 sm:mr-3">
            <ResTopNavbar data={data} />
          </div>
          <Link
            href="/"
            className={cn([
              integralCF.className,
              "text-lg sm:text-xl md:text-2xl lg:text-[28px] xl:text-[32px] leading-none mr-3 md:mr-5 lg:mr-10 tracking-tight whitespace-nowrap",
            ])}
          >
            ShopSphere
          </Link>
        </div>

        {/* Center: desktop nav links */}
        <NavigationMenu className="hidden md:flex mr-2 lg:mr-7 shrink-0">
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
        <div className="hidden md:flex flex-1 min-w-0 mr-3 lg:mr-6 max-w-xs lg:max-w-md xl:max-w-lg">
          <SearchBar />
        </div>

        {/* Right group: icons */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <MobileSearchSheet />
          <WishlistBtn />
          <CartBtn />
          <AccountBtn />
        </div>
      </div>
    </nav>
  );
};

export default TopNavbar;
