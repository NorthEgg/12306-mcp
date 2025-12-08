import { TZDate } from "@date-fns/tz";
import {
  API_BASE,
  DW_FLAGS,
  LCQUERY_INIT_URL,
  MISSING_STATIONS,
  SEAT_TYPES,
  STATION_DATA_KEYS,
  TICKET_DATA_KEYS,
  TIME_COMPARETOR,
  TIME_ZONE,
  TRAIN_FILTERS,
  WEB_URL,
} from "../constant/index.ts";
import type {
  InterlineData,
  InterlineInfo,
  InterlineTicketData,
  Price,
  RouteStationData,
  RouteStationInfo,
  StationData,
  TicketData,
  TicketInfo,
} from "../types/index";
import axios from "axios";
import { format, parse } from "date-fns";

export async function getStations(): Promise<Record<string, StationData>> {
  const html = await make12306Request<string>(WEB_URL);
  if (html == null) {
    throw new Error("Error: get 12306 web page failed.");
  }
  const match = html.match(".(/script/core/common/station_name.+?.js)");
  if (match == null) {
    throw new Error("Error: get station name js file failed.");
  }
  const stationNameJSFilePath = match[0];
  const stationNameJS = await make12306Request<string>(new URL(stationNameJSFilePath, WEB_URL));
  if (stationNameJS == null) {
    throw new Error("Error: get station name js file failed.");
  }
  const rawData = eval(stationNameJS.replace("var station_names =", ""));
  const stationsData = parseStationsData(rawData);
  // 加上缺失的车站信息
  for (const station of MISSING_STATIONS) {
    if (!stationsData[station.station_code]) {
      stationsData[station.station_code] = station;
    }
  }
  return stationsData;
}

export async function make12306Request<T>(
  url: string | URL,
  scheme: URLSearchParams = new URLSearchParams(),
  headers: Record<string, string> = {}
): Promise<T | null> {
  try {
    const response = await axios.get(url + "?" + scheme.toString(), {
      headers: headers,
    });
    return (await response.data) as T;
  } catch (error) {
    console.error("Error making 12306 request:", error);
    return null;
  }
}

export function parseStationsData(rawData: string): Record<string, StationData> {
  const result: Record<string, StationData> = {};
  const dataArray = rawData.split("|");
  const dataList: string[][] = [];
  for (let i = 0; i < Math.floor(dataArray.length / 10); i++) {
    dataList.push(dataArray.slice(i * 10, i * 10 + 10));
  }
  for (const group of dataList) {
    let station: Partial<StationData> = {};
    STATION_DATA_KEYS.forEach((key, index) => {
      station[key] = group[index];
    });
    if (!station.station_code) {
      continue;
    }
    result[station.station_code!] = station as StationData;
  }
  return result;
}

export function checkDate(date: string): boolean {
  const timeZone = "Asia/Shanghai";
  const nowInShanghai = TZDate.tz(TIME_ZONE);
  nowInShanghai.setHours(0, 0, 0, 0);
  const inputInShanghai = TZDate.tz(timeZone, new Date(date));
  inputInShanghai.setHours(0, 0, 0, 0);
  return inputInShanghai >= nowInShanghai;
}

export async function getCookie() {
  const url = `${API_BASE}/otn/leftTicket/init`;
  try {
    const response = await fetch(url);
    const setCookieHeader = response.headers.getSetCookie();
    if (setCookieHeader) {
      return parseCookies(setCookieHeader);
    }
    return null;
  } catch (error) {
    console.error("Error making 12306 request:", error);
    return null;
  }
}

export function parseCookies(cookies: Array<string>): Record<string, string> {
  const cookieRecord: Record<string, string> = {};
  cookies.forEach((cookie) => {
    // 提取键值对部分（去掉 Path、HttpOnly 等属性）
    const keyValuePart = cookie.split(";")[0];
    // 分割键和值
    const [key, value] = keyValuePart.split("=");
    // 存入对象
    if (key && value) {
      cookieRecord[key.trim()] = value.trim();
    }
  });
  return cookieRecord;
}

export function formatCookies(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

export function parseTicketsData(rawData: string[]): TicketData[] {
  const result: TicketData[] = [];
  for (const item of rawData) {
    const values = item.split("|");
    const entry: Partial<TicketData> = {};
    TICKET_DATA_KEYS.forEach((key, index) => {
      entry[key] = values[index];
    });
    result.push(entry as TicketData);
  }
  return result;
}

export function parseTicketsInfo(
  ticketsData: TicketData[],
  map: Record<string, string>
): TicketInfo[] {
  const result: TicketInfo[] = [];
  for (const ticket of ticketsData) {
    const prices = extractPrices(ticket.yp_info_new, ticket.seat_discount_info, ticket);
    const dw_flag = extractDWFlags(ticket.dw_flag);
    const startHours = parseInt(ticket.start_time.split(":")[0]);
    const startMinutes = parseInt(ticket.start_time.split(":")[1]);
    const durationHours = parseInt(ticket.lishi.split(":")[0]);
    const durationMinutes = parseInt(ticket.lishi.split(":")[1]);
    const startDate = parse(ticket.start_train_date, "yyyyMMdd", new Date());
    startDate.setHours(startHours, startMinutes);
    const arriveDate = startDate;
    arriveDate.setHours(startHours + durationHours, startMinutes + durationMinutes);
    result.push({
      train_no: ticket.train_no,
      start_date: format(startDate, "yyyy-MM-dd"),
      arrive_date: format(arriveDate, "yyyy-MM-dd"),
      start_train_code: ticket.station_train_code,
      start_time: ticket.start_time,
      arrive_time: ticket.arrive_time,
      lishi: ticket.lishi,
      from_station: map[ticket.from_station_telecode],
      to_station: map[ticket.to_station_telecode],
      from_station_telecode: ticket.from_station_telecode,
      to_station_telecode: ticket.to_station_telecode,
      prices: prices,
      dw_flag: dw_flag,
    });
  }
  return result;
}

export function extractPrices(
  yp_info: string,
  seat_discount_info: string,
  ticketData: TicketData | InterlineTicketData
): Price[] {
  const PRICE_STR_LENGTH = 10;
  const DISCOUNT_STR_LENGTH = 5;
  const prices: Price[] = [];
  const discounts: { [key: string]: number } = {};
  for (let i = 0; i < seat_discount_info.length / DISCOUNT_STR_LENGTH; i++) {
    const discount_str = seat_discount_info.slice(
      i * DISCOUNT_STR_LENGTH,
      (i + 1) * DISCOUNT_STR_LENGTH
    );
    discounts[discount_str[0]] = parseInt(discount_str.slice(1), 10);
  }

  for (let i = 0; i < yp_info.length / PRICE_STR_LENGTH; i++) {
    const price_str = yp_info.slice(i * PRICE_STR_LENGTH, (i + 1) * PRICE_STR_LENGTH);
    var seat_type_code;
    if (parseInt(price_str.slice(6, 10), 10) >= 3000) {
      // 根据12306的js逆向出来的，不懂。
      seat_type_code = "W"; // 为无座
    } else if (!Object.keys(SEAT_TYPES).includes(price_str[0])) {
      seat_type_code = "H"; // 其他坐席
    } else {
      seat_type_code = price_str[0];
    }
    const seat_type = SEAT_TYPES[seat_type_code as keyof typeof SEAT_TYPES];
    const price = parseInt(price_str.slice(1, 6), 10) / 10;
    const discount = seat_type_code in discounts ? discounts[seat_type_code] : null;
    prices.push({
      seat_name: seat_type.name,
      short: seat_type.short,
      seat_type_code,
      num: ticketData[`${seat_type.short}_num` as keyof (TicketData | InterlineTicketData)],
      price,
      discount,
    });
  }
  return prices;
}

export function extractDWFlags(dw_flag_str: string): string[] {
  const dwFlagList = dw_flag_str.split("#");
  let result = [];
  if ("5" == dwFlagList[0]) {
    result.push(DW_FLAGS[0]);
  }
  if (dwFlagList.length > 1 && "1" == dwFlagList[1]) {
    result.push(DW_FLAGS[1]);
  }
  if (dwFlagList.length > 2) {
    if ("Q" == dwFlagList[2].substring(0, 1)) {
      result.push(DW_FLAGS[2]);
    } else if ("R" == dwFlagList[2].substring(0, 1)) {
      result.push(DW_FLAGS[3]);
    }
  }
  if (dwFlagList.length > 5 && "D" == dwFlagList[5]) {
    result.push(DW_FLAGS[4]);
  }
  if (dwFlagList.length > 6 && "z" != dwFlagList[6]) {
    result.push(DW_FLAGS[5]);
  }
  if (dwFlagList.length > 7 && "z" != dwFlagList[7]) {
    result.push(DW_FLAGS[6]);
  }
  return result;
}

export function filterTicketsInfo<T extends TicketInfo | InterlineInfo>(
  ticketsInfo: T[],
  trainFilterFlags: string,
  earliestStartTime: number = 0,
  latestStartTime: number = 24,
  sortFlag: string = "",
  sortReverse: boolean = false,
  limitedNum: number = 0
): T[] {
  let result: T[];
  // FilterFlags过滤
  if (trainFilterFlags.length === 0) {
    result = ticketsInfo;
  } else {
    result = [];
    for (const ticketInfo of ticketsInfo) {
      for (const filter of trainFilterFlags) {
        if (TRAIN_FILTERS[filter as keyof typeof TRAIN_FILTERS](ticketInfo)) {
          result.push(ticketInfo);
          break;
        }
      }
    }
  }
  // startTime 过滤
  result = result.filter((ticketInfo) => {
    const startTimeHour = parseInt(ticketInfo.start_time.split(":")[0], 10);
    if (startTimeHour >= earliestStartTime && startTimeHour < latestStartTime) {
      return true;
    }
    return false;
  });

  // sort排序
  if (Object.keys(TIME_COMPARETOR).includes(sortFlag)) {
    result.sort(TIME_COMPARETOR[sortFlag as keyof typeof TIME_COMPARETOR]);
    if (sortReverse) {
      result.reverse();
    }
  }
  if (limitedNum == 0) {
    return result;
  }
  return result.slice(0, limitedNum);
}

export function formatTicketsInfoCSV(ticketsInfo: TicketInfo[]): string {
  if (ticketsInfo.length === 0) {
    return "没有查询到相关车次信息";
  }
  let result = "车次,出发站,到达站,出发时间,到达时间,历时,票价,特色标签\n";
  ticketsInfo.forEach((ticketInfo) => {
    let infoStr = "";
    infoStr += `${ticketInfo.start_train_code},${ticketInfo.from_station}(telecode:${ticketInfo.from_station_telecode}),${ticketInfo.to_station}(telecode:${ticketInfo.to_station_telecode}),${ticketInfo.start_time},${ticketInfo.arrive_time},${ticketInfo.lishi},[`;
    ticketInfo.prices.forEach((price) => {
      const ticketStatus = formatTicketStatus(price.num);
      infoStr += `${price.seat_name}: ${ticketStatus}${price.price}元,`;
    });
    infoStr += `],${ticketInfo.dw_flag.length == 0 ? "/" : ticketInfo.dw_flag.join("&")}`;
    result += `${infoStr}\n`;
  });
  return result;
}

/**
 * 格式化票量信息，提供语义化描述
 * @param num 票量数字或状态字符串
 * @returns 格式化后的票量描述
 */
export function formatTicketStatus(num: string): string {
  // 检查是否为纯数字
  if (num.match(/^\d+$/)) {
    const count = parseInt(num);
    if (count === 0) {
      return "无票";
    } else {
      return `剩余${count}张票`;
    }
  }

  // 处理特殊状态字符串
  switch (num) {
    case "有":
    case "充足":
      return "有票";
    case "无":
    case "--":
    case "":
      return "无票";
    case "候补":
      return "无票需候补";
    default:
      return `${num}票`;
  }
}

export function formatTicketsInfo(ticketsInfo: TicketInfo[]): string {
  if (ticketsInfo.length === 0) {
    return "没有查询到相关车次信息";
  }
  let result = "车次|出发站 -> 到达站|出发时间 -> 到达时间|历时\n";
  ticketsInfo.forEach((ticketInfo) => {
    let infoStr = "";
    infoStr += `${ticketInfo.start_train_code} ${ticketInfo.from_station}(telecode:${ticketInfo.from_station_telecode}) -> ${ticketInfo.to_station}(telecode:${ticketInfo.to_station_telecode}) ${ticketInfo.start_time} -> ${ticketInfo.arrive_time} 历时：${ticketInfo.lishi}`;
    ticketInfo.prices.forEach((price) => {
      const ticketStatus = formatTicketStatus(price.num);
      infoStr += `\n- ${price.seat_name}: ${ticketStatus} ${price.price}元`;
    });
    result += `${infoStr}\n`;
  });
  return result;
}

export async function getLCQueryPath(): Promise<string> {
  const html = await make12306Request<string>(LCQUERY_INIT_URL);
  if (html == null) {
    throw new Error("Error: get 12306 web page failed.");
  }
  const match = html.match(/ var lc_search_url = '(.+?)'/);
  if (match == null) {
    throw new Error("Error: get station name js file failed.");
  }
  return match[1];
}

export function parseInterlinesInfo(interlineData: InterlineData[]): InterlineInfo[] {
  const result: InterlineInfo[] = [];
  for (const ticket of interlineData) {
    const interlineTickets = parseInterlinesTicketInfo(ticket.fullList);
    const lishi = extractLishi(ticket.all_lishi);
    result.push({
      lishi: lishi,
      start_time: ticket.start_time,
      start_date: ticket.train_date,
      middle_date: ticket.middle_date,
      arrive_date: ticket.arrive_date,
      arrive_time: ticket.arrive_time,
      from_station_code: ticket.from_station_code,
      from_station_name: ticket.from_station_name,
      middle_station_code: ticket.middle_station_code,
      middle_station_name: ticket.middle_station_name,
      end_station_code: ticket.end_station_code,
      end_station_name: ticket.end_station_name,
      start_train_code: interlineTickets[0].start_train_code,
      first_train_no: ticket.first_train_no,
      second_train_no: ticket.second_train_no,
      train_count: ticket.train_count,
      ticketList: interlineTickets,
      same_station: ticket.same_station == "0" ? true : false,
      same_train: ticket.same_train == "Y" ? true : false,
      wait_time: ticket.wait_time,
    });
  }
  return result;
}

export function parseInterlinesTicketInfo(interlineTicketsData: InterlineTicketData[]) {
  const result: TicketInfo[] = [];
  for (const interlineTicketData of interlineTicketsData) {
    const prices = extractPrices(
      interlineTicketData.yp_info,
      interlineTicketData.seat_discount_info,
      interlineTicketData
    );
    const startHours = parseInt(interlineTicketData.start_time.split(":")[0]);
    const startMinutes = parseInt(interlineTicketData.start_time.split(":")[1]);
    const durationHours = parseInt(interlineTicketData.lishi.split(":")[0]);
    const durationMinutes = parseInt(interlineTicketData.lishi.split(":")[1]);
    const startDate = parse(interlineTicketData.start_train_date, "yyyyMMdd", new Date());
    startDate.setHours(startHours, startMinutes);
    const arriveDate = startDate;
    arriveDate.setHours(startHours + durationHours, startMinutes + durationMinutes);
    result.push({
      train_no: interlineTicketData.train_no,
      start_train_code: interlineTicketData.station_train_code,
      start_date: format(startDate, "yyyy-MM-dd"),
      arrive_date: format(arriveDate, "yyyy-MM-dd"),
      start_time: interlineTicketData.start_time,
      arrive_time: interlineTicketData.arrive_time,
      lishi: interlineTicketData.lishi,
      from_station: interlineTicketData.from_station_name,
      to_station: interlineTicketData.to_station_name,
      from_station_telecode: interlineTicketData.from_station_telecode,
      to_station_telecode: interlineTicketData.to_station_telecode,
      prices: prices,
      dw_flag: extractDWFlags(interlineTicketData.dw_flag),
    });
  }
  return result;
}

/**
 * 格式化历时数据为hh:mm，为比较历时做准备。
 * @param all_lishi interlineTicket中的历时数据， 形如：H小时M分钟或M分钟
 * @returns 和普通余票数据中的lishi字段一样的hh:mm格式的历时
 */
function extractLishi(all_lishi: string): string {
  const match = all_lishi.match(/(?:(\d+)小时)?(\d+?)分钟/);
  if (!match) {
    throw new Error("extractLishi失败，没有匹配到关键词");
  }
  if (!match[1]) {
    return `00:${match[2]}`;
  }
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export function formatInterlinesInfo(interlinesInfo: InterlineInfo[]): string {
  let result =
    "出发时间 -> 到达时间 | 出发车站 -> 中转车站 -> 到达车站 | 换乘标志 |换乘等待时间| 总历时\n\n";
  interlinesInfo.forEach((interlineInfo) => {
    result += `${interlineInfo.start_date} ${interlineInfo.start_time} -> ${interlineInfo.arrive_date} ${interlineInfo.arrive_time} | `;
    result += `${interlineInfo.from_station_name} -> ${interlineInfo.middle_station_name} -> ${interlineInfo.end_station_name} | `;
    result += `${
      interlineInfo.same_train ? "同车换乘" : interlineInfo.same_station ? "同站换乘" : "换站换乘"
    } | ${interlineInfo.wait_time} | ${interlineInfo.lishi}\n\n`;
    result += "\t" + formatTicketsInfo(interlineInfo.ticketList).replace(/\n/g, "\n\t");
    result += "\n";
  });
  return result;
}

export function parseRouteStationsInfo(routeStationsData: RouteStationData[]): RouteStationInfo[] {
  const result: RouteStationInfo[] = [];
  routeStationsData.forEach((routeStationData, index) => {
    if (index == 0) {
      result.push({
        train_class_name: routeStationData.train_class_name,
        service_type: routeStationData.service_type,
        end_station_name: routeStationData.end_station_name,
        station_name: routeStationData.station_name,
        station_train_code: routeStationData.station_train_code,
        arrive_time: routeStationData.arrive_time,
        start_time: routeStationData.start_time,
        lishi: routeStationData.running_time,
        arrive_day_str: routeStationData.arrive_day_str,
      });
    } else {
      result.push({
        station_name: routeStationData.station_name,
        station_train_code: routeStationData.station_train_code,
        arrive_time: routeStationData.arrive_time,
        start_time: routeStationData.start_time,
        lishi: routeStationData.running_time,
        arrive_day_str: routeStationData.arrive_day_str,
      });
    }
  });
  return result;
}

export function formatRouteStationsInfo(routeStationsInfo: RouteStationInfo[]): string {
  let result = `${routeStationsInfo[0].station_train_code}次列车（${
    routeStationsInfo[0].train_class_name
  } ${
    routeStationsInfo[0].service_type == "0" ? "无空调" : "有空调"
  }）\n站序|车站|车次|到达时间|出发时间|历时(hh:mm)\n`;
  routeStationsInfo.forEach((routeStationInfo, index) => {
    result += `${index + 1}|${routeStationInfo.station_name}|${
      routeStationInfo.station_train_code
    }|${routeStationInfo.arrive_time}|${routeStationInfo.start_time}|${
      routeStationInfo.arrive_day_str
    } ${routeStationInfo.lishi}\n`;
  });
  return result;
}
