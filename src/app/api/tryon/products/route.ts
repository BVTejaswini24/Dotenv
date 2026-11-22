import { NextResponse } from "next/server";
import { FEATURED_TRYON_PRODUCTS } from "@/lib/utils/tryon";

export async function GET() {
  return NextResponse.json({
    data: {
      products: FEATURED_TRYON_PRODUCTS,
      total: FEATURED_TRYON_PRODUCTS.length,
    },
  });
}
