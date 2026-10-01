import { createFileRoute } from "@tanstack/react-router";
import { WatchPage } from "@/components/pit/watch-page";

export const Route = createFileRoute("/watch")({ component: WatchPage });
