import { createFileRoute } from "@tanstack/react-router";
import { StorePage } from "@/components/pit/store-page";

export const Route = createFileRoute("/stores/$storeId")({
  component: function StoreRoute() {
    const { storeId } = Route.useParams();
    return <StorePage storeId={storeId} />;
  },
});
