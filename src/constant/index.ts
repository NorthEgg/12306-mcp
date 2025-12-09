import type { InterlineInfo, StationData, TicketData, TicketInfo } from "../types/index";
import { getLCQueryPath, getStations } from "../utils/index.js";

export const TIME_ZONE = "Asia/Shanghai";
export const API_BASE = "https://kyfw.12306.cn";
export const SEARCH_API_BASE = "https://search.12306.cn";
export const WEB_URL = "https://www.12306.cn/index/";
export const LCQUERY_INIT_URL = "https://kyfw.12306.cn/otn/lcQuery/init";
export const MISSING_STATIONS: StationData[] = [
  {
    station_id: "@cdd",
    station_name: "成  都东",
    station_code: "WEI",
    station_pinyin: "chengdudong",
    station_short: "cdd",
    station_index: "",
    code: "1707",
    city: "成都",
    r1: "",
    r2: "",
  },
];
export const STATION_DATA_KEYS: (keyof StationData)[] = [
  "station_id",
  "station_name",
  "station_code",
  "station_pinyin",
  "station_short",
  "station_index",
  "code",
  "city",
  "r1",
  "r2",
];

export const TICKET_DATA_KEYS: (keyof TicketData)[] = [
  "secret_Sstr",
  "button_text_info",
  "train_no",
  "station_train_code",
  "start_station_telecode",
  "end_station_telecode",
  "from_station_telecode",
  "to_station_telecode",
  "start_time",
  "arrive_time",
  "lishi",
  "canWebBuy",
  "yp_info",
  "start_train_date",
  "train_seat_feature",
  "location_code",
  "from_station_no",
  "to_station_no",
  "is_support_card",
  "controlled_train_flag",
  "gg_num",
  "gr_num",
  "qt_num",
  "rw_num",
  "rz_num",
  "tz_num",
  "wz_num",
  "yb_num",
  "yw_num",
  "yz_num",
  "ze_num",
  "zy_num",
  "swz_num",
  "srrb_num",
  "yp_ex",
  "seat_types",
  "exchange_train_flag",
  "houbu_train_flag",
  "houbu_seat_limit",
  "yp_info_new",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
  "dw_flag",
  "47",
  "stopcheckTime",
  "country_flag",
  "local_arrive_time",
  "local_start_time",
  "52",
  "bed_level_info",
  "seat_discount_info",
  "sale_time",
  "56",
];

export const SEAT_TYPES = {
  "9": { name: "商务座", short: "swz" },
  P: { name: "特等座", short: "tz" },
  M: { name: "一等座", short: "zy" },
  D: { name: "优选一等座", short: "zy" },
  O: { name: "二等座", short: "ze" },
  S: { name: "二等包座", short: "ze" },
  "6": { name: "高级软卧", short: "gr" },
  A: { name: "高级动卧", short: "gr" },
  "4": { name: "软卧", short: "rw" },
  I: { name: "一等卧", short: "rw" },
  F: { name: "动卧", short: "rw" },
  "3": { name: "硬卧", short: "yw" },
  J: { name: "二等卧", short: "yw" },
  "2": { name: "软座", short: "rz" },
  "1": { name: "硬座", short: "yz" },
  W: { name: "无座", short: "wz" },
  WZ: { name: "无座", short: "wz" },
  H: { name: "其他", short: "qt" },
};
export const DW_FLAGS = [
  "智能动车组",
  "复兴号",
  "静音车厢",
  "温馨动卧",
  "动感号",
  "支持选铺",
  "老年优惠",
];

export const TRAIN_FILTERS = {
  //G(高铁/城际),D(动车),Z(直达特快),T(特快),K(快速),O(其他),F(复兴号),S(智能动车组)
  G: (ticketInfo: TicketInfo | InterlineInfo) => {
    return ticketInfo.start_train_code.startsWith("G") ||
      ticketInfo.start_train_code.startsWith("C")
      ? true
      : false;
  },
  D: (ticketInfo: TicketInfo | InterlineInfo) => {
    return ticketInfo.start_train_code.startsWith("D") ? true : false;
  },
  Z: (ticketInfo: TicketInfo | InterlineInfo) => {
    return ticketInfo.start_train_code.startsWith("Z") ? true : false;
  },
  T: (ticketInfo: TicketInfo | InterlineInfo) => {
    return ticketInfo.start_train_code.startsWith("T") ? true : false;
  },
  K: (ticketInfo: TicketInfo | InterlineInfo) => {
    return ticketInfo.start_train_code.startsWith("K") ? true : false;
  },
  O: (ticketInfo: TicketInfo | InterlineInfo) => {
    return TRAIN_FILTERS.G(ticketInfo) ||
      TRAIN_FILTERS.D(ticketInfo) ||
      TRAIN_FILTERS.Z(ticketInfo) ||
      TRAIN_FILTERS.T(ticketInfo) ||
      TRAIN_FILTERS.K(ticketInfo)
      ? false
      : true;
  },
  F: (ticketInfo: TicketInfo | InterlineInfo) => {
    if ("dw_flag" in ticketInfo) {
      return ticketInfo.dw_flag.includes("复兴号") ? true : false;
    }
    return ticketInfo.ticketList[0]!.dw_flag.includes("复兴号") ? true : false;
  },
  S: (ticketInfo: TicketInfo | InterlineInfo) => {
    if ("dw_flag" in ticketInfo) {
      return ticketInfo.dw_flag.includes("智能动车组") ? true : false;
    }
    return ticketInfo.ticketList[0]!.dw_flag.includes("智能动车组") ? true : false;
  },
};
export const TIME_COMPARETOR = {
  startTime: (ticketInfoA: TicketInfo | InterlineInfo, ticketInfoB: TicketInfo | InterlineInfo) => {
    const timeA = new Date(ticketInfoA.start_date);
    const timeB = new Date(ticketInfoB.start_date);
    if (timeA.getTime() != timeB.getTime()) {
      return timeA.getTime() - timeB.getTime();
    }
    const startTimeA = ticketInfoA.start_time.split(":");
    const startTimeB = ticketInfoB.start_time.split(":");
    const hourA = parseInt(startTimeA[0]!);
    const hourB = parseInt(startTimeB[0]!);
    if (hourA != hourB) {
      return hourA - hourB;
    }
    const minuteA = parseInt(startTimeA[1]!);
    const minuteB = parseInt(startTimeB[1]!);
    return minuteA - minuteB;
  },
  arriveTime: (
    ticketInfoA: TicketInfo | InterlineInfo,
    ticketInfoB: TicketInfo | InterlineInfo
  ) => {
    const timeA = new Date(ticketInfoA.arrive_date);
    const timeB = new Date(ticketInfoB.arrive_date);
    if (timeA.getTime() != timeB.getTime()) {
      return timeA.getTime() - timeB.getTime();
    }
    const arriveTimeA = ticketInfoA.arrive_time.split(":");
    const arriveTimeB = ticketInfoB.arrive_time.split(":");
    const hourA = parseInt(arriveTimeA[0]!);
    const hourB = parseInt(arriveTimeB[0]!);
    if (hourA != hourB) {
      return hourA - hourB;
    }
    const minuteA = parseInt(arriveTimeA[1]!);
    const minuteB = parseInt(arriveTimeB[1]!);
    return minuteA - minuteB;
  },
  duration: (ticketInfoA: TicketInfo | InterlineInfo, ticketInfoB: TicketInfo | InterlineInfo) => {
    const lishiTimeA = ticketInfoA.lishi.split(":");
    const lishiTimeB = ticketInfoB.lishi.split(":");
    const hourA = parseInt(lishiTimeA[0]!);
    const hourB = parseInt(lishiTimeB[0]!);
    if (hourA != hourB) {
      return hourA - hourB;
    }
    const minuteA = parseInt(lishiTimeA[1]!);
    const minuteB = parseInt(lishiTimeB[1]!);
    return minuteA - minuteB;
  },
};
export const STATIONS: Record<string, StationData> = await getStations(); //以Code为键
/** 以城市名名为键，位于该城市的的所有Station列表的记录 */
export const CITY_STATIONS: Record<string, { station_code: string; station_name: string }[]> =
  (() => {
    const result: Record<string, { station_code: string; station_name: string }[]> = {};
    for (const station of Object.values(STATIONS)) {
      const city = station.city;
      if (!result[city]) {
        result[city] = [];
      }
      result[city].push({
        station_code: station.station_code,
        station_name: station.station_name,
      });
    }
    return result;
  })();

/** 以城市名名为键的Station记录 */
export const CITY_CODES: Record<string, { station_code: string; station_name: string }> = (() => {
  const result: Record<string, { station_code: string; station_name: string }> = {};
  for (const [city, stations] of Object.entries(CITY_STATIONS)) {
    for (const station of stations) {
      if (station.station_name == city) {
        result[city] = station;
        break;
      }
    }
  }
  return result;
})();

/** 以车站名为键的Station记录 */
export const NAME_STATIONS: Record<string, { station_code: string; station_name: string }> =
  (() => {
    const result: Record<string, { station_code: string; station_name: string }> = {};
    for (const station of Object.values(STATIONS)) {
      const station_name = station.station_name;
      result[station_name] = {
        station_code: station.station_code,
        station_name: station.station_name,
      };
    }
    return result;
  })();

export const LCQUERY_PATH = await getLCQueryPath();
