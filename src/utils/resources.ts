import { STATIONS } from "../constant/index.ts";
import { server } from "./server.ts";

server.addResource({
  uri: "data://all-stations",
  name: "stations",
  description: "所有站点数据",
  async load() {
    return {
      text: JSON.stringify(STATIONS),
    };
  },
});
