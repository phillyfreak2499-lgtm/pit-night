import { createFileRoute } from "@tanstack/react-router";
import { RulesPage } from "@/components/pit/rules-page";

export const Route = createFileRoute("/rules")({ component: RulesPage });
