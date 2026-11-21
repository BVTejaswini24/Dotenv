import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { satoshi } from "@/styles/fonts";
import { cn } from "@/lib/utils";
import TopBannerClient from "@/components/layout/Banner/TopBannerClient";
import TopNavbar from "@/components/layout/Navbar/TopNavbar";
import Footer from "@/components/layout/Footer";
import HolyLoader from "holy-loader";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "ShopSphere",
  description: "ShopSphere - Your Modern Fashion Destination",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="overflow-x-hidden">
      <body className={cn(satoshi.className, "overflow-x-hidden")}>
        <HolyLoader color="#868686" />
        <Providers>
          <TopBannerClient />
          <TopNavbar />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
