import { server } from "./utils/server.ts";
import "./utils/resources.ts";
import "./utils/tools.ts";

server.start({
  transportType: "stdio",
});
