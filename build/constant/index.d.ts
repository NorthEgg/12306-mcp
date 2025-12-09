import type { InterlineInfo, StationData, TicketData, TicketInfo } from "../types/index";
export declare const TIME_ZONE = "Asia/Shanghai";
export declare const API_BASE = "https://kyfw.12306.cn";
export declare const SEARCH_API_BASE = "https://search.12306.cn";
export declare const WEB_URL = "https://www.12306.cn/index/";
export declare const LCQUERY_INIT_URL = "https://kyfw.12306.cn/otn/lcQuery/init";
export declare const MISSING_STATIONS: StationData[];
export declare const STATION_DATA_KEYS: (keyof StationData)[];
export declare const TICKET_DATA_KEYS: (keyof TicketData)[];
export declare const SEAT_TYPES: {
    "9": {
        name: string;
        short: string;
    };
    P: {
        name: string;
        short: string;
    };
    M: {
        name: string;
        short: string;
    };
    D: {
        name: string;
        short: string;
    };
    O: {
        name: string;
        short: string;
    };
    S: {
        name: string;
        short: string;
    };
    "6": {
        name: string;
        short: string;
    };
    A: {
        name: string;
        short: string;
    };
    "4": {
        name: string;
        short: string;
    };
    I: {
        name: string;
        short: string;
    };
    F: {
        name: string;
        short: string;
    };
    "3": {
        name: string;
        short: string;
    };
    J: {
        name: string;
        short: string;
    };
    "2": {
        name: string;
        short: string;
    };
    "1": {
        name: string;
        short: string;
    };
    W: {
        name: string;
        short: string;
    };
    WZ: {
        name: string;
        short: string;
    };
    H: {
        name: string;
        short: string;
    };
};
export declare const DW_FLAGS: string[];
export declare const TRAIN_FILTERS: {
    G: (ticketInfo: TicketInfo | InterlineInfo) => boolean;
    D: (ticketInfo: TicketInfo | InterlineInfo) => boolean;
    Z: (ticketInfo: TicketInfo | InterlineInfo) => boolean;
    T: (ticketInfo: TicketInfo | InterlineInfo) => boolean;
    K: (ticketInfo: TicketInfo | InterlineInfo) => boolean;
    O: (ticketInfo: TicketInfo | InterlineInfo) => boolean;
    F: (ticketInfo: TicketInfo | InterlineInfo) => boolean;
    S: (ticketInfo: TicketInfo | InterlineInfo) => boolean;
};
export declare const TIME_COMPARETOR: {
    startTime: (ticketInfoA: TicketInfo | InterlineInfo, ticketInfoB: TicketInfo | InterlineInfo) => number;
    arriveTime: (ticketInfoA: TicketInfo | InterlineInfo, ticketInfoB: TicketInfo | InterlineInfo) => number;
    duration: (ticketInfoA: TicketInfo | InterlineInfo, ticketInfoB: TicketInfo | InterlineInfo) => number;
};
export declare const STATIONS: Record<string, StationData>;
/** 以城市名名为键，位于该城市的的所有Station列表的记录 */
export declare const CITY_STATIONS: Record<string, {
    station_code: string;
    station_name: string;
}[]>;
/** 以城市名名为键的Station记录 */
export declare const CITY_CODES: Record<string, {
    station_code: string;
    station_name: string;
}>;
/** 以车站名为键的Station记录 */
export declare const NAME_STATIONS: Record<string, {
    station_code: string;
    station_name: string;
}>;
export declare const LCQUERY_PATH: string | undefined;
