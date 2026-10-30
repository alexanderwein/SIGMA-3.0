
/*
=========================================================
 SIGMA 3.0 — BINANCE MARKET DATA ENGINE
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

            let message = `Binance API error: ${response.status}`;

            try {

                const error = await response.json();

                if (error.msg) {
                    message += " - " + error.msg;
                }

            } catch {
                // Keep original HTTP error.
            }

            throw new Error(message);

        }

        return await response.json();

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
   LIVE PRICE
===================================================== */

export async function getPrice(symbol) {

    if (!symbol) {

        throw new Error("Missing cryptocurrency symbol.");

    }

    const url = apiURL(API.PRICE, {

        symbol

    });

    const data = await request(url);

    return {

        symbol: data.symbol,

        price: Number(data.price),

        timestamp: Date.now()

    };

}


/* =====================================================
   24 HOUR MARKET STATISTICS
===================================================== */

export async function get24HourTicker(symbol) {

    const params = symbol ? { symbol } : {};

    const url = apiURL(API.TICKER, params);

    const data = await request(url);

    if (Array.isArray(data)) {

        return data.map(normalizeTicker);

    }

    return normalizeTicker(data);

}


function normalizeTicker(data) {

    return {

        symbol: data.symbol,

        price: Number(data.lastPrice),

        openPrice: Number(data.openPrice),

        high: Number(data.highPrice),

        low: Number(data.lowPrice),

        volume: Number(data.volume),

        quoteVolume: Number(data.quoteVolume),

        change: Number(data.priceChange),

        changePercent: Number(data.priceChangePercent),

        trades: Number(data.count),

        weightedAverage: Number(data.weightedAvgPrice),

        timestamp: Date.now()

    };

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

    const timeframe = CONFIG.TIMEFRAMES[interval];

    if (!timeframe) {

        throw new Error(
            "Unsupported timeframe: " + interval
        );

    }

    const safeLimit = Math.min(
        Math.max(Number(limit) || 500, 1),
        1000
    );

    const params = {

        symbol,

        interval: timeframe.interval,

        limit: safeLimit

    };

    if (endTime !== undefined) {

        params.endTime = endTime;

    }

    const url = apiURL(API.KLINES, params);

    const raw = await request(url);

    return raw.map(normalizeCandle);

}


function normalizeCandle(candle) {

    return {

        time: Math.floor(Number(candle[0]) / 1000),

        openTime: Number(candle[0]),

        open: Number(candle[1]),

        high: Number(candle[2]),

        low: Number(candle[3]),

        close: Number(candle[4]),

        volume: Number(candle[5]),

        closeTime: Number(candle[6]),

        quoteVolume: Number(candle[7]),

        trades: Number(candle[8]),

        takerBuyBaseVolume: Number(candle[9]),

        takerBuyQuoteVolume: Number(candle[10]),

        closed: Number(candle[6]) < Date.now()

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

    const timeframe = CONFIG.TIMEFRAMES[interval];

    if (!timeframe) {

        throw new Error("Invalid timeframe.");

    }

    const target = Math.max(
        1,
        Math.floor(Number(totalCandles) || 2000)
    );

    const result = [];

    let endTime = undefined;

    while (result.length < target) {

        const remaining = target - result.length;

        const batchSize = Math.min(remaining, 1000);

        const batch = await getCandles(

            symbol,

            interval,

            batchSize,

            endTime

        );

        if (!batch.length) {

            break;

        }

        result.unshift(...batch);

        const oldestTime = batch[0].openTime;

        endTime = oldestTime - 1;

        if (batch.length < batchSize) {

            break;

        }

        // Avoid excessive requests.

        if (result.length < target) {

            await new Promise(resolve =>
                setTimeout(resolve, 150)
            );

        }

    }

    // Remove any duplicate timestamps.

    const unique = new Map();

    result.forEach(candle => {

        unique.set(candle.time, candle);

    });

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

    const data = await get24HourTicker();

    const excluded = CONFIG.SCANNER.EXCLUDED_ASSETS;

    const suffixes = CONFIG.SCANNER.EXCLUDED_SUFFIXES;

    return data

        .filter(item => {

            if (!item.symbol.endsWith("USDT")) {

                return false;

            }

            if (excluded.includes(item.symbol)) {

                return false;

            }

            if (suffixes.some(suffix =>
                item.symbol.endsWith(suffix)
            )) {

                return false;

            }

            if (
                !Number.isFinite(item.price) ||
                item.price <= 0
            ) {

                return false;

            }

            if (
                item.quoteVolume <
                CONFIG.SCANNER.MIN_QUOTE_VOLUME
            ) {

                return false;

            }

            return true;

        })

        .sort((a, b) =>
            b.quoteVolume - a.quoteVolume
        )

        .slice(0, limit);

}


/* =====================================================
   MULTIPLE LIVE PRICES
===================================================== */

export async function getMultiplePrices(symbols) {

    if (!Array.isArray(symbols) || !symbols.length) {

        return [];

    }

    const requested = new Set(symbols);

    const data = await getPriceList();

    return data

        .filter(item => requested.has(item.symbol))

        .map(item => ({

            symbol: item.symbol,

            price: Number(item.price)

        }));

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

    const params = symbol ? { symbol } : {};

    const url = apiURL(API.EXCHANGE_INFO, params);

    return request(url);

}


/* =====================================================
   MARKET DATA VALIDATION
===================================================== */

export function validateCandles(candles) {

    if (!Array.isArray(candles)) {

        return false;

    }

    if (candles.length < 2) {

        return false;

    }

    return candles.every((candle, index) => {

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
            candle.volume < 0 ||
            candle.open <= 0 ||
            candle.close <= 0
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
