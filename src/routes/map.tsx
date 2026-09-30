import { createFileRoute } from "@tanstack/react-router";
import { PitMap } from "@/components/pit/map-page";

export const Route = createFileRoute("/map")({ component: PitMap });
