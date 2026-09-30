import { createFileRoute } from "@tanstack/react-router";
import { ShopPage } from "@/components/pit/shop-page";

export const Route = createFileRoute("/shop/$storeId")({
  component: function ShopRoute() {
    const { storeId } = Route.useParams();
    return <ShopPage storeId={storeId} />;
  },
});
