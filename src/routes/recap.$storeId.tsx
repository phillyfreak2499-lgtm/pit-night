import { createFileRoute } from "@tanstack/react-router";
import { RecapPage } from "@/components/pit/recap-page";

export const Route = createFileRoute("/recap/$storeId")({
  component: function RecapRoute() {
    const { storeId } = Route.useParams();
    return <RecapPage storeId={storeId} />;
  },
});
