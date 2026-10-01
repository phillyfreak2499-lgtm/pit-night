import { createFileRoute } from "@tanstack/react-router";
import { WeekPage } from "@/components/pit/week-page";

export const Route = createFileRoute("/week")({ component: WeekPage });
