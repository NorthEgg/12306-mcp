import { STATIONS } from "../constant/index.js";
import { server } from "./server.js";

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
