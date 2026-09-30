import { createFileRoute } from "@tanstack/react-router";
import { HonorsPage } from "@/components/pit/honors-page";

export const Route = createFileRoute("/honors")({ component: HonorsPage });
