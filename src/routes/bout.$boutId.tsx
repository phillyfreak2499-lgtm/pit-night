import { createFileRoute } from "@tanstack/react-router";
import { BoutPage } from "@/components/pit/bout-page";

export const Route = createFileRoute("/bout/$boutId")({
  component: function BoutRoute() {
    const { boutId } = Route.useParams();
    return <BoutPage boutId={boutId} />;
  },
});
