import { createFileRoute } from "@tanstack/react-router";
import { ShowPage } from "@/components/pit/show-page";

export const Route = createFileRoute("/broadcast")({ component: ShowPage });
