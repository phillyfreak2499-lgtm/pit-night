import { createFileRoute } from "@tanstack/react-router";
import { GaragePage } from "@/components/pit/garage-page";

export const Route = createFileRoute("/garage/$storeId")({
  component: function GarageRoute() {
    const { storeId } = Route.useParams();
    return <GaragePage storeId={storeId} />;
  },
});
