import { createFileRoute } from "@tanstack/react-router";
import { DamagePage } from "@/components/pit/damage-page";

export const Route = createFileRoute("/damage")({ component: DamagePage });
