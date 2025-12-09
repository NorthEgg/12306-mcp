#!/usr/bin/env node
import { server } from "./utils/server.js";
import "./utils/resources.js";
import "./utils/tools.js";
server.start({
    transportType: "stdio",
});
