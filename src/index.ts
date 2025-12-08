import { z } from "zod";
import { server } from "./utils/server.ts";
import "./utils/resources.ts";
import "./utils/tools.ts";

server.addTool({
  name: "add",
  description: "Add two numbers",
  parameters: z.object({
    a: z.number(),
    b: z.number(),
  }),
  execute: async (args) => {
    return String(args.a + args.b);
  },
});

server.start({
  transportType: "stdio",
});
