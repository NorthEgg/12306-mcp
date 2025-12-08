import { format } from "date-fns";
import {
  API_BASE,
  CITY_CODES,
  CITY_STATIONS,
  LCQUERY_PATH,
  NAME_STATIONS,
  SEARCH_API_BASE,
  STATIONS,
  TIME_ZONE,
} from "../constant/index.ts";
import { server } from "./server.ts";
import { TZDate } from "@date-fns/tz";
import { z } from "zod";
import {
  checkDate,
  filterTicketsInfo,
  formatCookies,
  formatInterlinesInfo,
  formatRouteStationsInfo,
  formatTicketsInfo,
  formatTicketsInfoCSV,
  getCookie,
  make12306Request,
  parseInterlinesInfo,
  parseRouteStationsInfo,
  parseTicketsData,
  parseTicketsInfo,
} from "./index.ts";
import type {
  InterlineData,
  InterlineInfo,
  InterlineQueryResponse,
  LeftTicketsQueryResponse,
  RouteQueryResponse,
  TicketInfo,
  TrainSearchResponse,
} from "../types/index";

/** 获取当前日期 */
server.addTool({
  name: "get-current-date",
  description:
    '获取当前日期，以上海时区（Asia/Shanghai, UTC+8）为准，返回格式为 "yyyy-MM-dd"。主要用于解析用户提到的相对日期（如“明天”、“下周三”），提供准确的日期输入。',
  async execute() {
    try {
      const nowInShanghai = TZDate.tz(TIME_ZONE);
      const formattedDate = format(nowInShanghai, "yyyy-MM-dd");
      return formattedDate;
    } catch (error) {
      console.error("Error getting current date:", error);
      return "Error: Failed to get current date.";
    }
  },
});

/** 中文城市名查询该城市所有火车站的名称及code */
server.addTool({
  name: "get-stations-code-in-city",
  description:
    "通过中文城市名查询该城市 **所有** 火车站的名称及其对应的 `station_code`，结果是一个包含多个车站信息的列表。",
  parameters: z.object({
    city: z.string().describe('中文城市名称，例如："北京", "上海"'),
  }),
  async execute({ city }) {
    if (!(city in CITY_STATIONS)) {
      return "Error: City not found. ";
    }
    return JSON.stringify(CITY_STATIONS[city]);
  },
});

/** 中文城市名批量查询对应城市所有火车站的名称及code */
server.addTool({
  name: "get-station-code-of-citys",
  description:
    "通过中文城市名查询代表该城市的 `station_code`。此接口主要用于在用户提供**城市名**作为出发地或到达地时，为接口准备 `station_code` 参数。",
  parameters: z.object({
    citys: z
      .string()
      .describe('要查询的城市，比如"北京"。若要查询多个城市，请用|分割，比如"北京|上海"。'),
  }),
  async execute({ citys }) {
    let result: Record<string, object> = {};
    for (const city of citys.split("|")) {
      if (!(city in CITY_CODES)) {
        result[city] = { error: "未检索到城市。" };
      } else {
        result[city] = CITY_CODES[city];
      }
    }
    return JSON.stringify(result);
  },
});

/** 中文车站名查询火车站的名称及code */
server.addTool({
  name: "get-station-code-by-names",
  description:
    "通过具体的中文车站名查询其 `station_code` 和车站名。此接口主要用于在用户提供**具体车站名**作为出发地或到达地时，为接口准备 `station_code` 参数。",
  parameters: z.object({
    stationNames: z
      .string()
      .describe(
        '具体的中文车站名称，例如："北京南", "上海虹桥"。若要查询多个站点，请用|分割，比如"北京南|上海虹桥"。'
      ),
  }),
  async execute({ stationNames }) {
    let result: Record<string, object> = {};
    for (let stationName of stationNames.split("|")) {
      stationName = stationName.endsWith("站") ? stationName.substring(0, -1) : stationName;
      if (!(stationName in NAME_STATIONS)) {
        result[stationName] = { error: "未检索到城市。" };
      } else {
        result[stationName] = NAME_STATIONS[stationName];
      }
    }
    return JSON.stringify(result);
  },
});

/** 通过车站的 `station_telecode` 查询车站的详细信息 */
server.addTool({
  name: "get-station-by-telecode",
  description:
    "通过车站的 `station_telecode` 查询车站的详细信息，包括名称、拼音、所属城市等。此接口主要用于在已知 `telecode` 的情况下获取更完整的车站数据，或用于特殊查询及调试目的。一般用户对话流程中较少直接触发。",
  parameters: z.object({
    stationTelecode: z.string().describe("车站的 `station_telecode` (3位字母编码)"),
  }),
  async execute({ stationTelecode }) {
    if (!STATIONS[stationTelecode]) {
      return "Error: Station not found. ";
    }
    return JSON.stringify(STATIONS[stationTelecode]);
  },
});

/** 查询12306余票信息 */
server.addTool({
  name: "get-tickets",
  description: "查询12306余票信息。",
  parameters: z.object({
    date: z
      .string()
      .length(10)
      .describe(
        '查询日期，格式为 "yyyy-MM-dd"。如果用户提供的是相对日期（如“明天”），请务必先调用 `get-current-date` 接口获取当前日期，并计算出目标日期。'
      ),
    fromStation: z
      .string()
      .describe(
        "出发地的 `station_code` 。必须是通过 `get-station-code-by-names` 或 `get-station-code-of-citys` 接口查询得到的编码，严禁直接使用中文地名。"
      ),
    toStation: z
      .string()
      .describe(
        "到达地的 `station_code` 。必须是通过 `get-station-code-by-names` 或 `get-station-code-of-citys` 接口查询得到的编码，严禁直接使用中文地名。"
      ),
    trainFilterFlags: z
      .string()
      .regex(/^[GDZTKOFS]*$/)
      .max(8)
      .optional()
      .default("")
      .describe(
        '车次筛选条件，默认为空，即不筛选。支持多个标志同时筛选。例如用户说“高铁票”，则应使用 "G"。可选标志：[G(高铁/城际),D(动车),Z(直达特快),T(特快),K(快速),O(其他),F(复兴号),S(智能动车组)]'
      ),
    earliestStartTime: z
      .number()
      .min(0)
      .max(24)
      .optional()
      .default(0)
      .describe("最早出发时间（0-24），默认为0。"),
    latestStartTime: z
      .number()
      .min(0)
      .max(24)
      .optional()
      .default(24)
      .describe("最迟出发时间（0-24），默认为24。"),
    sortFlag: z
      .string()
      .optional()
      .default("")
      .describe(
        "排序方式，默认为空，即不排序。仅支持单一标识。可选标志：[startTime(出发时间从早到晚), arriveTime(抵达时间从早到晚), duration(历时从短到长)]"
      ),
    sortReverse: z
      .boolean()
      .optional()
      .default(false)
      .describe("是否逆向排序结果，默认为false。仅在设置了sortFlag时生效。"),
    limitedNum: z
      .number()
      .min(0)
      .optional()
      .default(0)
      .describe("返回的余票数量限制，默认为0，即不限制。"),
    format: z
      .string()
      .regex(/^(text|csv|json)$/i)
      .default("text")
      .optional()
      .describe("返回结果格式，默认为text，建议使用text与csv。可选标志：[text, csv, json]"),
  }),
  async execute({
    date,
    fromStation,
    toStation,
    trainFilterFlags,
    earliestStartTime,
    latestStartTime,
    sortFlag,
    sortReverse,
    limitedNum,
    format,
  }) {
    // 检查日期是否早于当前日期
    if (!checkDate(date)) {
      return "Error: The date cannot be earlier than today.";
    }
    if (
      !Object.keys(STATIONS).includes(fromStation) ||
      !Object.keys(STATIONS).includes(toStation)
    ) {
      return "Error: Station not found. ";
    }
    const queryParams = new URLSearchParams({
      "leftTicketDTO.train_date": date,
      "leftTicketDTO.from_station": fromStation,
      "leftTicketDTO.to_station": toStation,
      purpose_codes: "ADULT",
    });
    const queryUrl = `${API_BASE}/otn/leftTicket/query`;
    const cookies = await getCookie();
    if (cookies == null || Object.entries(cookies).length === 0) {
      return "Error: get cookie failed. Check your network.";
    }
    const queryResponse = await make12306Request<LeftTicketsQueryResponse>(queryUrl, queryParams, {
      Cookie: formatCookies(cookies),
    });
    if (queryResponse === null || queryResponse === undefined) {
      return "Error: get tickets data failed. ";
    }
    const ticketsData = parseTicketsData(queryResponse.data.result);
    let ticketsInfo: TicketInfo[];
    try {
      ticketsInfo = parseTicketsInfo(ticketsData, queryResponse.data.map);
    } catch (error) {
      console.error("Error: parse tickets info failed. ", error);
      return "Error: parse tickets info failed. ";
    }
    const filteredTicketsInfo = filterTicketsInfo<TicketInfo>(
      ticketsInfo,
      trainFilterFlags,
      earliestStartTime,
      latestStartTime,
      sortFlag,
      sortReverse,
      limitedNum
    );
    let formatedResult;
    switch (format) {
      case "csv":
        formatedResult = formatTicketsInfoCSV(filteredTicketsInfo);
        break;
      case "json":
        formatedResult = JSON.stringify(filteredTicketsInfo);
        break;
      default:
        formatedResult = formatTicketsInfo(filteredTicketsInfo);
        break;
    }
    return formatedResult;
  },
});

/** 查询12306中转余票信息 */
server.addTool({
  name: "get-interline-tickets",
  description: "查询12306中转余票信息。尚且只支持查询前十条。",
  parameters: z.object({
    date: z
      .string()
      .length(10)
      .describe(
        '查询日期，格式为 "yyyy-MM-dd"。如果用户提供的是相对日期（如“明天”），请务必先调用 `get-current-date` 接口获取当前日期，并计算出目标日期。'
      ),
    fromStation: z
      .string()
      .describe(
        "出发地的 `station_code` 。必须是通过 `get-station-code-by-names` 或 `get-station-code-of-citys` 接口查询得到的编码，严禁直接使用中文地名。"
      ),
    toStation: z
      .string()
      .describe(
        "出发地的 `station_code` 。必须是通过 `get-station-code-by-names` 或 `get-station-code-of-citys` 接口查询得到的编码，严禁直接使用中文地名。"
      ),
    middleStation: z
      .string()
      .optional()
      .default("")
      .describe(
        "中转地的 `station_code` ，可选。必须是通过 `get-station-code-by-names` 或 `get-station-code-of-citys` 接口查询得到的编码，严禁直接使用中文地名。"
      ),
    showWZ: z.boolean().optional().default(false).describe("是否显示无座车，默认不显示无座车。"),
    trainFilterFlags: z
      .string()
      .regex(/^[GDZTKOFS]*$/)
      .max(8)
      .optional()
      .default("")
      .describe(
        "车次筛选条件，默认为空。从以下标志中选取多个条件组合[G(高铁/城际),D(动车),Z(直达特快),T(特快),K(快速),O(其他),F(复兴号),S(智能动车组)]"
      ),
    earliestStartTime: z
      .number()
      .min(0)
      .max(24)
      .optional()
      .default(0)
      .describe("最早出发时间（0-24），默认为0。"),
    latestStartTime: z
      .number()
      .min(0)
      .max(24)
      .optional()
      .default(24)
      .describe("最迟出发时间（0-24），默认为24。"),
    sortFlag: z
      .string()
      .optional()
      .default("")
      .describe(
        "排序方式，默认为空，即不排序。仅支持单一标识。可选标志：[startTime(出发时间从早到晚), arriveTime(抵达时间从早到晚), duration(历时从短到长)]"
      ),
    sortReverse: z
      .boolean()
      .optional()
      .default(false)
      .describe("是否逆向排序结果，默认为false。仅在设置了sortFlag时生效。"),
    limitedNum: z
      .number()
      .min(1)
      .optional()
      .default(10)
      .describe("返回的中转余票数量限制，默认为10。"),
    format: z
      .string()
      .regex(/^(text|json)$/i)
      .default("text")
      .optional()
      .describe("返回结果格式，默认为text，建议使用text。可选标志：[text, json]"),
  }),
  async execute({
    date,
    fromStation,
    toStation,
    middleStation,
    showWZ,
    trainFilterFlags,
    earliestStartTime,
    latestStartTime,
    sortFlag,
    sortReverse,
    limitedNum,
    format,
  }) {
    // 检查日期是否早于当前日期
    if (!checkDate(date)) {
      return "Error: The date cannot be earlier than today.";
    }
    if (
      !Object.keys(STATIONS).includes(fromStation) ||
      !Object.keys(STATIONS).includes(toStation)
    ) {
      return "Error: Station not found. ";
    }
    const queryUrl = `${API_BASE}${LCQUERY_PATH}`;
    const cookies = await getCookie();
    if (cookies == null || Object.entries(cookies).length === 0) {
      return "Error: get cookie failed. Check your network.";
    }

    var interlineData: InterlineData[] = [];
    const queryParams = new URLSearchParams({
      train_date: date,
      from_station_telecode: fromStation,
      to_station_telecode: toStation,
      middle_station: middleStation,
      result_index: "0",
      can_query: "Y",
      isShowWZ: showWZ ? "Y" : "N",
      purpose_codes: "00", // 00: 成人票 0X: 学生票
      channel: "E", // 没搞清楚什么用
    });
    while (interlineData.length < limitedNum) {
      const queryResponse = await make12306Request<InterlineQueryResponse>(queryUrl, queryParams, {
        Cookie: formatCookies(cookies),
      });
      // 处理请求错误
      if (queryResponse === null || queryResponse === undefined) {
        return "Error: request interline tickets data failed. ";
      }
      // 请求成功，但查询有误
      if (typeof queryResponse.data == "string") {
        return `很抱歉，未查到相关的列车余票。(${queryResponse.errorMsg})`;
      }
      interlineData = interlineData.concat(queryResponse.data.middleList);
      if (queryResponse.data.can_query == "N") {
        break;
      }
      queryParams.set("result_index", queryResponse.data.result_index.toString());
    }
    // 请求和查询都没问题
    let interlineTicketsInfo: InterlineInfo[];
    try {
      interlineTicketsInfo = parseInterlinesInfo(interlineData);
    } catch (error) {
      return `Error: parse tickets info failed. ${error}`;
    }
    const filteredInterlineTicketsInfo = filterTicketsInfo<InterlineInfo>(
      interlineTicketsInfo,
      trainFilterFlags,
      earliestStartTime,
      latestStartTime,
      sortFlag,
      sortReverse,
      limitedNum
    );
    var formatedResult;
    switch (format) {
      case "json":
        formatedResult = JSON.stringify(filteredInterlineTicketsInfo);
        break;
      default:
        formatedResult = formatInterlinesInfo(filteredInterlineTicketsInfo);
        break;
    }
    return formatedResult;
  },
});

/** 查询列车的经停站 */
server.addTool({
  name: "get-train-route-stations",
  description:
    "查询特定列车车次在指定区间内的途径车站、到站时间、出发时间及停留时间等详细经停信息。当用户询问某趟具体列车的经停站时使用此接口。",
  parameters: z.object({
    trainCode: z.string().describe('要查询的车次 `train_code`，例如"G1033"。'),
    departDate: z
      .string()
      .length(10)
      .describe(
        "列车出发的日期 (格式: yyyy-MM-dd)。如果用户提供的是相对日期，请务必先调用 `get-current-date` 解析。"
      ),
    format: z
      .string()
      .regex(/^(text|json)$/i)
      .default("text")
      .optional()
      .describe("返回结果格式，默认为text，建议使用text。可选标志：[text, json]"),
  }),
  async execute({ trainCode, departDate, format }) {
    const searchParams = new URLSearchParams({
      keyword: trainCode,
      date: departDate.replaceAll("-", ""),
    });
    const searchUrl = `${SEARCH_API_BASE}/search/v1/train/search`;
    const searchResponse = await make12306Request<TrainSearchResponse>(searchUrl, searchParams);
    if (
      searchResponse == null ||
      searchResponse.data.length == 0 ||
      searchResponse.data == undefined
    ) {
      return "很抱歉，未查询到对应车次。";
    }

    const searchData = searchResponse.data[0];
    const queryParams = new URLSearchParams({
      "leftTicketDTO.train_no": searchData.train_no,
      "leftTicketDTO.train_date": departDate,
      rand_code: "",
    });
    const queryUrl = `${API_BASE}/otn/queryTrainInfo/query`;
    const cookies = await getCookie();
    if (cookies == null || Object.entries(cookies).length === 0) {
      return "Error: get cookie failed. Check your network.";
    }
    const queryResponse = await make12306Request<RouteQueryResponse>(queryUrl, queryParams, {
      Cookie: formatCookies(cookies),
    });
    if (queryResponse == null || queryResponse.data == undefined) {
      return "Error: get train route stations failed. ";
    }
    const routeStationsInfo = parseRouteStationsInfo(queryResponse.data.data);
    if (routeStationsInfo.length == 0) {
      return "未查询到相关车次信息。";
    }
    var formatedResult;
    switch (format) {
      case "json":
        formatedResult = JSON.stringify(routeStationsInfo);
        break;
      default:
        formatedResult = formatRouteStationsInfo(routeStationsInfo);
        break;
    }
    return formatedResult;
  },
});
