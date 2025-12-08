import type { StationData } from "../types/index";
import { getStations } from "../utils/index.ts";

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

export const STATIONS: Record<string, StationData> = await getStations(); //以Code为键
