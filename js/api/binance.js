
/*
=========================================================
 SIGMA 3.0 — BINANCE MARKET DATA ENGINE
 CORRECTED VERSION
=========================================================

Responsibilities:
- Retrieve live prices
- Retrieve historical OHLCV candles
- Retrieve 24-hour market statistics
- Retrieve top USDT markets
- Normalize exchange data
- Handle API errors and timeouts
- Support historical pagination

Public Binance API only.
No trading or account permissions required.
=========================================================
*/

import { CONFIG, apiURL } from "../config.js";

const API = CONFIG.API.ENDPOINTS;


/* =====================================================
   GENERAL HTTP REQUEST
===================================================== */

async function request(url) {

    if (typeof url !== "string" || !url) {
        throw new Error("Invalid Binance API URL.");
    }

    const controller = new AbortController();

    const timeout = setTimeout(
        () => controller.abort(),
        CONFIG.API_TIMEOUT
    );

    try {

        const response = await fetch(url, {

            method: "GET",

            headers: {
                "Accept": "application/json"
            },

            signal: controller.signal

        });

        if (!response.ok) {

            let message =
                `Binance API error: ${response.status}`;

            try {

                const error = await response.json();

                if (error?.msg) {
                    message += " - " + error.msg;
                }

            } catch {
                // Preserve original HTTP error.
            }

            throw new Error(message);

        }

        const data = await response.json();

        if (data === null || data === undefined) {

            throw new Error(
                "Invalid response from Binance API."
            );

        }

        return data;

    } catch (error) {

        if (error.name === "AbortError") {

            throw new Error(
                "Binance API request timed out."
            );

        }

        throw error;

    } finally {

        clearTimeout(timeout);

    }

}


/* =====================================================
   SYMBOL VALIDATION
===================================================== */

function normalizeSymbol(symbol) {

    if (
        typeof symbol !== "string" ||
        !symbol.trim()
    ) {

        throw new Error(
            "Missing cryptocurrency symbol."
        );

    }

    const normalized = symbol.trim().toUpperCase();

    if (!/^[A-Z0-9]+$/.test(normalized)) {

        throw new Error(
            "Invalid cryptocurrency symbol."
        );

    }

    return normalized;

}


/* =====================================================
   LIVE PRICE
===================================================== */

export async function getPrice(symbol) {

    const normalized = normalizeSymbol(symbol);

    const url = apiURL(API.PRICE, {

        symbol: normalized

    });

    const data = await request(url);

    const price = Number(data.price);

    if (
        data.symbol !== normalized ||
        !Number.isFinite(price) ||
        price <= 0
    ) {

        throw new Error(
            "Invalid price data received from Binance."
        );

    }

    return {

        symbol: data.symbol,

        price,

        timestamp: Date.now()

    };

}


/* =====================================================
   24 HOUR MARKET STATISTICS
===================================================== */

export async function get24HourTicker(symbol) {

    const params = symbol

        ? { symbol: normalizeSymbol(symbol) }

        : {};

    const url = apiURL(API.TICKER, params);

    const data = await request(url);

    if (Array.isArray(data)) {

        return data.map(normalizeTicker);

    }

    if (!data || typeof data !== "object") {

        throw new Error(
            "Invalid ticker response from Binance."
        );

    }

    return normalizeTicker(data);

}


function normalizeTicker(data) {

    if (
        !data ||
        typeof data.symbol !== "string"
    ) {

        throw new Error(
            "Invalid ticker data received from Binance."
        );

    }

    const numericFields = {

        price: data.lastPrice,

        openPrice: data.openPrice,

        high: data.highPrice,

        low: data.lowPrice,

        volume: data.volume,

        quoteVolume: data.quoteVolume,

        change: data.priceChange,

        changePercent: data.priceChangePercent,

        trades: data.count,

        weightedAverage: data.weightedAvgPrice

    };

    const result = {

        symbol: data.symbol

    };

    for (const [key, value] of Object.entries(numericFields)) {

        const number = Number(value);

        result[key] = Number.isFinite(number)
            ? number
            : 0;

    }

    result.timestamp = Date.now();

    return result;

}


/* =====================================================
   HISTORICAL CANDLE DATA
===================================================== */

export async function getCandles(

    symbol = CONFIG.DEFAULT_ASSET,

    interval = CONFIG.DEFAULT_TIMEFRAME,

    limit = 500,

    endTime = undefined

) {

    const normalized = normalizeSymbol(symbol);

    const timeframe = CONFIG.TIMEFRAMES[interval];

    if (!timeframe || !timeframe.interval) {

        throw new Error(
            "Unsupported timeframe: " + interval
        );

    }

    const requestedLimit = Number(limit);

    const safeLimit = Math.min(

        Math.max(

            Number.isFinite(requestedLimit)
                ? Math.floor(requestedLimit)
                : 500,

            1

        ),

        1000

    );

    const params = {

        symbol: normalized,

        interval: timeframe.interval,

        limit: safeLimit

    };

    if (endTime !== undefined) {

        const timestamp = Number(endTime);

        if (
            !Number.isFinite(timestamp) ||
            timestamp < 0
        ) {

            throw new Error(
                "Invalid candle endTime."
            );

        }

        params.endTime = Math.floor(timestamp);

    }

    const url = apiURL(API.KLINES, params);

    const raw = await request(url);

    if (!Array.isArray(raw)) {

        throw new Error(
            "Invalid candle response from Binance."
        );

    }

    return raw.map(normalizeCandle);

}


function normalizeCandle(candle) {

    if (
        !Array.isArray(candle) ||
        candle.length < 12
    ) {

        throw new Error(
            "Invalid OHLCV candle received from Binance."
        );

    }

    const openTime = Number(candle[0]);

    const open = Number(candle[1]);

    const high = Number(candle[2]);

    const low = Number(candle[3]);

    const close = Number(candle[4]);

    const volume = Number(candle[5]);

    const closeTime = Number(candle[6]);

    const quoteVolume = Number(candle[7]);

    const trades = Number(candle[8]);

    const takerBuyBaseVolume = Number(candle[9]);

    const takerBuyQuoteVolume = Number(candle[10]);

    const values = [

        openTime,
        open,
        high,
        low,
        close,
        volume,
        closeTime,
        quoteVolume,
        trades,
        takerBuyBaseVolume,
        takerBuyQuoteVolume

    ];

    if (!values.every(Number.isFinite)) {

        throw new Error(
            "Binance returned invalid numeric candle values."
        );

    }

    return {

        time: Math.floor(openTime / 1000),

        openTime,

        open,

        high,

        low,

        close,

        volume,

        closeTime,

        quoteVolume,

        trades,

        takerBuyBaseVolume,

        takerBuyQuoteVolume,

        closed: closeTime < Date.now()

    };

}


/* =====================================================
   HISTORICAL DATA PAGINATION
===================================================== */

/*
Retrieve multiple historical batches.

Useful for:
- Long-term technical analysis
- Backtesting
- Historical forecasting validation

Binance limits each request to 1000 candles.
*/

export async function getHistoricalCandles(

    symbol,

    interval,

    totalCandles = 2000

) {

    const normalized = normalizeSymbol(symbol);

    const timeframe = CONFIG.TIMEFRAMES[interval];

    if (!timeframe || !timeframe.interval) {

        throw new Error("Invalid timeframe.");

    }

    const requestedTotal = Number(totalCandles);

    const target = Math.max(

        1,

        Math.floor(

            Number.isFinite(requestedTotal)
                ? requestedTotal
                : 2000

        )

    );

    const result = [];

    let endTime = undefined;

    while (result.length < target) {

        const remaining = target - result.length;

        const batchSize = Math.min(
            remaining,
            1000
        );

        const batch = await getCandles(

            normalized,

            interval,

            batchSize,

            endTime

        );

        if (!batch.length) {
            break;
        }

        // Insert older candles before newer candles.

        result.unshift(...batch);

        const oldestTime = batch[0].openTime;

        endTime = oldestTime - 1;

        // No more historical data available.

        if (batch.length < batchSize) {
            break;
        }

        // Avoid excessive API requests.

        if (result.length < target) {

            await new Promise(resolve => {

                setTimeout(resolve, 150);

            });

        }

    }

    // Remove duplicate timestamps.

    const unique = new Map();

    for (const candle of result) {

        unique.set(candle.time, candle);

    }

    return Array.from(unique.values())

        .sort((a, b) => a.time - b.time)

        .slice(-target);

}


/* =====================================================
   TOP USDT MARKETS
===================================================== */

export async function getTopMarkets(

    limit = CONFIG.SCANNER.TOP_MARKETS

) {

    const requestedLimit = Number(limit);

    const safeLimit = Math.max(

        1,

        Math.floor(

            Number.isFinite(requestedLimit)
                ? requestedLimit
                : CONFIG.SCANNER.TOP_MARKETS

        )

    );

    const data = await get24HourTicker();

    const excluded = Array.isArray(
        CONFIG.SCANNER.EXCLUDED_ASSETS
    )
        ? CONFIG.SCANNER.EXCLUDED_ASSETS
        : [];

    const suffixes = Array.isArray(
        CONFIG.SCANNER.EXCLUDED_SUFFIXES
    )
        ? CONFIG.SCANNER.EXCLUDED_SUFFIXES
        : [];

    const minimumVolume = Number(
        CONFIG.SCANNER.MIN_QUOTE_VOLUME
    );

    return data

        .filter(item => {

            if (!item.symbol.endsWith("USDT")) {
                return false;
            }

            if (excluded.includes(item.symbol)) {
                return false;
            }

            if (
                suffixes.some(suffix =>
                    item.symbol.endsWith(suffix)
                )
            ) {

                return false;

            }

            if (
                !Number.isFinite(item.price) ||
                item.price <= 0
            ) {

                return false;

            }

            if (
                !Number.isFinite(item.quoteVolume) ||
                item.quoteVolume < minimumVolume
            ) {

                return false;

            }

            return true;

        })

        .sort((a, b) =>
            b.quoteVolume - a.quoteVolume
        )

        .slice(0, safeLimit);

}


/* =====================================================
   MULTIPLE LIVE PRICES
===================================================== */

export async function getMultiplePrices(symbols) {

    if (!Array.isArray(symbols) || !symbols.length) {

        return [];

    }

    const requested = new Set(

        symbols

            .filter(symbol =>
                typeof symbol === "string"
            )

            .map(symbol =>
                symbol.trim().toUpperCase()
            )

    );

    if (!requested.size) {
        return [];
    }

    const data = await getPriceList();

    if (!Array.isArray(data)) {

        throw new Error(
            "Invalid Binance price list response."
        );

    }

    return data

        .filter(item =>
            requested.has(item.symbol)
        )

        .map(item => ({

            symbol: item.symbol,

            price: Number(item.price)

        }))

        .filter(item =>
            Number.isFinite(item.price) &&
            item.price > 0
        );

}


async function getPriceList() {

    const url = apiURL(API.PRICE);

    return request(url);

}


/* =====================================================
   MARKET CONNECTION TEST
===================================================== */

export async function testConnection() {

    try {

        const price = await getPrice("BTCUSDT");

        return {

            connected: true,

            message: "Binance connection successful",

            btcPrice: price.price,

            timestamp: Date.now()

        };

    } catch (error) {

        return {

            connected: false,

            message: error.message,

            timestamp: Date.now()

        };

    }

}


/* =====================================================
   EXCHANGE INFORMATION
===================================================== */

export async function getExchangeInfo(symbol = undefined) {

    const params = symbol

        ? { symbol: normalizeSymbol(symbol) }

        : {};

    const url = apiURL(API.EXCHANGE_INFO, params);

    return request(url);

}


/* =====================================================
   MARKET DATA VALIDATION
===================================================== */

export function validateCandles(candles) {

    if (
        !Array.isArray(candles) ||
        candles.length < 2
    ) {

        return false;

    }

    return candles.every((candle, index) => {

        if (!candle || typeof candle !== "object") {
            return false;
        }

        const values = [

            candle.time,

            candle.open,

            candle.high,

            candle.low,

            candle.close,

            candle.volume

        ];

        const valid = values.every(Number.isFinite);

        if (!valid) {
            return false;
        }

        if (

            candle.high < candle.low ||

            candle.low <= 0 ||

            candle.open < candle.low ||

            candle.open > candle.high ||

            candle.close < candle.low ||

            candle.close > candle.high ||

            candle.volume < 0

        ) {

            return false;

        }

        if (

            index > 0 &&

            candle.time <= candles[index - 1].time

        ) {

            return false;

        }

        return true;

    });

}
