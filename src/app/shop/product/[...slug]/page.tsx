import { products } from "@/lib/data/products";
import { getAlternatives } from "@/lib/utils/recommendations";
import ProductListSec from "@/components/common/ProductListSec";
import BreadcrumbProduct from "@/components/product-page/BreadcrumbProduct";
import Header from "@/components/product-page/Header";
import Tabs from "@/components/product-page/Tabs";
import SmartAlternatives from "@/components/product-page/Alternatives";
import { notFound } from "next/navigation";

export default function ProductPage({
  params,
}: {
  params: { slug: string[] };
}) {
  const productData = products.find(
    (product) => product.id === Number(params.slug[0])
  );

  if (!productData?.title) {
    notFound();
  }

  const isOutOfStock =
    typeof productData.stock === "number" && productData.stock === 0;

  const alternatives = isOutOfStock
    ? getAlternatives(productData, products, 6)
    : [];

  return (
    <main className="pb-24 md:pb-0">
      <div className="max-w-frame mx-auto px-4 xl:px-0">
        <hr className="h-[1px] border-t-black/10 mb-5 sm:mb-6" />
        <BreadcrumbProduct title={productData?.title ?? "product"} />
        <section className="mb-11">
          <Header data={productData} />
        </section>
        <Tabs product={productData} />
        {isOutOfStock && (
          <div className="mb-10">
            <SmartAlternatives alternatives={alternatives} />
          </div>
        )}
      </div>
      {!isOutOfStock && (
        <div className="mb-[50px] sm:mb-20">
          <ProductListSec
            title="You might also like"
            data={
              products
                .filter(
                  (p) =>
                    p.id !== productData.id &&
                    (p.stock === undefined || p.stock > 0) &&
                    (p.category === productData.category ||
                      p.gender === productData.gender)
                )
                .slice(0, 4).length > 0
                ? products
                    .filter(
                      (p) =>
                        p.id !== productData.id &&
                        (p.stock === undefined || p.stock > 0) &&
                        (p.category === productData.category ||
                          p.gender === productData.gender)
                    )
                    .slice(0, 4)
                : products
                    .filter(
                      (p) =>
                        p.id !== productData.id &&
                        (p.stock === undefined || p.stock > 0)
                    )
                    .slice(0, 4)
            }
          />
        </div>
      )}
    </main>
  );
}
