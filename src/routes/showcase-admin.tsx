import { createFileRoute } from "@tanstack/react-router";
import { ShowcasePage } from "@/components/pit/showcase-page";
export const Route = createFileRoute("/showcase-admin")({ component: () => <ShowcasePage admin /> });
