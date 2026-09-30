import { createFileRoute } from "@tanstack/react-router";
import { GazettePage } from "@/components/pit/gazette-page";

export const Route = createFileRoute("/gazette")({ component: GazettePage });
