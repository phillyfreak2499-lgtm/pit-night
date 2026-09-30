import { createFileRoute } from "@tanstack/react-router";
import { PreviewPage } from "@/components/pit/preview-page";

export const Route = createFileRoute("/preview")({ component: PreviewPage });
