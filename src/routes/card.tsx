import { createFileRoute } from "@tanstack/react-router";
import { CardPage } from "@/components/pit/card-page";

export const Route = createFileRoute("/card")({ component: CardPage });
