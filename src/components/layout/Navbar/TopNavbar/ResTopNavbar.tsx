"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { integralCF } from "@/styles/fonts";
import { NavMenu } from "../navbar.types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Heart,
  User,
  LogOut,
  LogIn,
  ShoppingCart,
  Home,
  Package,
  Tag,
  Sparkles,
  Menu,
} from "lucide-react";
import { useAppSelector, useAppDispatch } from "@/lib/hooks/redux";
import { selectWishlistCount } from "@/lib/features/wishlist/wishlistSlice";
import {
  selectIsAuthenticated,
  selectCurrentUser,
  logout,
} from "@/lib/features/auth/authSlice";
import { RootState } from "@/lib/store";
import { toast } from "sonner";

const ResTopNavbar = ({ data }: { data: NavMenu }) => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const wishlistCount = useAppSelector(selectWishlistCount);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectCurrentUser);
  const cartCount = useAppSelector(
    (state: RootState) => state.carts.cart?.totalQuantities ?? 0
  );

  const handleSignOut = () => {
    dispatch(logout());
    toast.success("Signed out successfully");
    router.push("/");
  };

  const navIconMap: Record<string, React.ReactNode> = {
    Shop: <ShoppingCart size={16} />,
    "On Sale": <Tag size={16} />,
    "New Arrivals": <Sparkles size={16} />,
  };

  return (
    <Sheet>
      <SheetTrigger asChild className="cursor-pointer">
        <button
          type="button"
          aria-label="Open menu"
          className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-black/5 transition-colors"
        >
          <Menu size={22} />
        </button>
      </SheetTrigger>

      <SheetContent side="left" className="w-[300px] sm:w-[340px] overflow-y-auto p-0">
        {/* Header */}
        <SheetHeader className="px-5 pt-6 pb-4 border-b border-black/10">
          <SheetTitle asChild>
            <SheetClose asChild>
              <Link
                href="/"
                className={cn([integralCF.className, "text-xl tracking-tight block"])}
              >
                ShopSphere
              </Link>
            </SheetClose>
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col px-4 py-4">
          {/* Main Nav Links */}
          <div className="mb-2">
            <p className="text-xs font-semibold text-black/40 uppercase tracking-wider px-2 mb-2">
              Browse
            </p>
            <SheetClose asChild>
              <Link
                href="/"
                className="flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium text-black hover:bg-black/5 transition-colors"
              >
                <Home size={16} className="text-black/60" />
                Home
              </Link>
            </SheetClose>
            {data.map((item) => (
              <React.Fragment key={item.id}>
                {item.type === "MenuItem" && (
                  <SheetClose asChild>
                    <Link
                      href={item.url ?? "/"}
                      className="flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium text-black hover:bg-black/5 transition-colors"
                    >
                      {navIconMap[item.label] ?? <ShoppingCart size={16} className="text-black/60" />}
                      {item.label}
                    </Link>
                  </SheetClose>
                )}
                {item.type === "MenuList" && (
                  <div className="w-full">
                    <Accordion type="single" collapsible>
                      <AccordionItem value={item.label} className="border-none">
                        <AccordionTrigger className="text-left px-2 py-2.5 font-medium text-sm rounded-lg hover:bg-black/5">
                          {item.label}
                        </AccordionTrigger>
                        <AccordionContent className="pl-8 pb-0 flex flex-col">
                          {item.children.map((itemChild) => (
                            <SheetClose
                              key={itemChild.id}
                              asChild
                              className="w-fit py-2 text-sm"
                            >
                              <Link href={itemChild.url ?? "/"}>
                                {itemChild.label}
                              </Link>
                            </SheetClose>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          <hr className="border-black/10 my-3" />

          {/* Quick actions */}
          <div className="mb-2">
            <p className="text-xs font-semibold text-black/40 uppercase tracking-wider px-2 mb-2">
              My Lists
            </p>
            <SheetClose asChild>
              <Link
                href="/wishlist"
                className="flex items-center justify-between px-2 py-2.5 rounded-lg text-sm font-medium text-black hover:bg-black/5 transition-colors"
              >
                <span className="flex items-center gap-3">
                  <Heart size={16} className="text-black/60" />
                  Wishlist
                </span>
                {wishlistCount > 0 && (
                  <span className="bg-black text-white rounded-full px-1.5 text-xs min-w-[20px] text-center">
                    {wishlistCount}
                  </span>
                )}
              </Link>
            </SheetClose>
            <SheetClose asChild>
              <Link
                href="/cart"
                className="flex items-center justify-between px-2 py-2.5 rounded-lg text-sm font-medium text-black hover:bg-black/5 transition-colors"
              >
                <span className="flex items-center gap-3">
                  <ShoppingCart size={16} className="text-black/60" />
                  Cart
                </span>
                {cartCount > 0 && (
                  <span className="bg-black text-white rounded-full px-1.5 text-xs min-w-[20px] text-center">
                    {cartCount}
                  </span>
                )}
              </Link>
            </SheetClose>
            <SheetClose asChild>
              <Link
                href="/orders"
                className="flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium text-black hover:bg-black/5 transition-colors"
              >
                <Package size={16} className="text-black/60" />
                My Orders
              </Link>
            </SheetClose>
          </div>

          <hr className="border-black/10 my-3" />

          {/* Account section */}
          <div>
            <p className="text-xs font-semibold text-black/40 uppercase tracking-wider px-2 mb-2">
              Account
            </p>
            {isAuthenticated && user ? (
              <>
                <SheetClose asChild>
                  <Link
                    href="/account"
                    className="flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium text-black hover:bg-black/5 transition-colors"
                  >
                    <User size={16} className="text-black/60" />
                    <span className="truncate">
                      {user.firstName} {user.lastName}
                    </span>
                  </Link>
                </SheetClose>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors w-full text-left"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <SheetClose asChild>
                  <Link
                    href="/signin"
                    className="flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium text-black hover:bg-black/5 transition-colors"
                  >
                    <LogIn size={16} className="text-black/60" />
                    Sign In
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    href="/signup"
                    className="flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium text-black hover:bg-black/5 transition-colors"
                  >
                    <User size={16} className="text-black/60" />
                    Create Account
                  </Link>
                </SheetClose>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ResTopNavbar;
