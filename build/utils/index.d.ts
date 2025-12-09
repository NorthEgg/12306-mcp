import type { InterlineData, InterlineInfo, InterlineTicketData, Price, RouteStationData, RouteStationInfo, StationData, TicketData, TicketInfo } from "../types/index.js";
export declare function getStations(): Promise<Record<string, StationData>>;
export declare function make12306Request<T>(url: string | URL, scheme?: URLSearchParams, headers?: Record<string, string>): Promise<T | null>;
export declare function parseStationsData(rawData: string): Record<string, StationData>;
export declare function checkDate(date: string): boolean;
export declare function getCookie(): Promise<Record<string, string> | null>;
export declare function parseCookies(cookies: Array<string>): Record<string, string>;
export declare function formatCookies(cookies: Record<string, string>): string;
export declare function parseTicketsData(rawData: string[]): TicketData[];
export declare function parseTicketsInfo(ticketsData: TicketData[], map: Record<string, string>): TicketInfo[];
export declare function extractPrices(yp_info: string, seat_discount_info: string, ticketData: TicketData | InterlineTicketData): Price[];
export declare function extractDWFlags(dw_flag_str: string): (string | undefined)[];
export declare function filterTicketsInfo<T extends TicketInfo | InterlineInfo>(ticketsInfo: T[], trainFilterFlags: string, earliestStartTime?: number, latestStartTime?: number, sortFlag?: string, sortReverse?: boolean, limitedNum?: number): T[];
export declare function formatTicketsInfoCSV(ticketsInfo: TicketInfo[]): string;
/**
 * 格式化票量信息，提供语义化描述
 * @param num 票量数字或状态字符串
 * @returns 格式化后的票量描述
 */
export declare function formatTicketStatus(num: string): string;
export declare function formatTicketsInfo(ticketsInfo: TicketInfo[]): string;
export declare function getLCQueryPath(): Promise<string | undefined>;
export declare function parseInterlinesInfo(interlineData: InterlineData[]): InterlineInfo[];
export declare function parseInterlinesTicketInfo(interlineTicketsData: InterlineTicketData[]): TicketInfo[];
export declare function formatInterlinesInfo(interlinesInfo: InterlineInfo[]): string;
export declare function parseRouteStationsInfo(routeStationsData: RouteStationData[]): RouteStationInfo[];
export declare function formatRouteStationsInfo(routeStationsInfo: RouteStationInfo[]): string;
