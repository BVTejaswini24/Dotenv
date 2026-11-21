"use client";

import { useAppSelector } from "@/lib/hooks/redux";
import { selectIsAuthenticated, selectCurrentUser } from "@/lib/features/auth/authSlice";
import { User } from "lucide-react";
import Link from "next/link";

const AccountBtn = () => {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectCurrentUser);

  return (
    <Link
      href="/account"
      aria-label={isAuthenticated && user ? `Account: ${user.firstName}` : "Sign in"}
      className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-black/5 transition-colors"
    >
      <User size={20} className="text-black" />
      {isAuthenticated && user && (
        <span className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-green-500 border border-white" />
      )}
    </Link>
  );
};

export default AccountBtn;
