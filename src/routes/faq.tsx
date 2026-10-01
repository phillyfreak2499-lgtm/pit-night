import { createFileRoute } from "@tanstack/react-router";
import { FaqPage } from "@/components/pit/faq-page";

export const Route = createFileRoute("/faq")({ component: FaqPage });
