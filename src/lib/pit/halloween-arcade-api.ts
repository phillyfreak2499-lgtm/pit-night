import { createServerFn } from "@tanstack/react-start";
import { halloweenArcadeInputSchema } from "./halloween-arcade";

export const halloweenArcade = createServerFn({ method: "POST" })
  .validator(halloweenArcadeInputSchema)
  .handler(async ({ data }) => {
    const { handleHalloweenArcade } = await import("./halloween-arcade.server");
    return handleHalloweenArcade(data);
  });
