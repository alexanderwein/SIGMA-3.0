
/*
=========================================================
 SIGMA 3.0 — CENTRAL CONFIGURATION
=========================================================
*/

export const CONFIG = {

    APP_NAME: "SIGMA 3.0",

    VERSION: "3.0.0",

    REFRESH_INTERVAL: 60000,

    API_TIMEOUT: 15000,

    // Binance public market API

    API: {
        BASE_URL: "https://api.binance.com/api/v3",

        ENDPOINTS: {
            TICKER: "/ticker/24hr",
            KLINES: "/klines",
            PRICE: "/ticker/price",
            EXCHANGE_INFO: "/exchangeInfo"
        }
    },

    // Supported cryptocurrency markets

    DEFAULT_ASSET: "BTCUSDT",

    DEFAULT_TIMEFRAME: "1d",

    SUPPORTED_ASSETS: [
        "BTCUSDT",
        "ETHUSDT",
        "BNBUSDT",
        "SOLUSDT",
        "XRPUSDT",
        "DOGEUSDT",
        "ADAUSDT",
        "AVAXUSDT",
        "LINKUSDT",
        "DOTUSDT",
        "LTCUSDT",
        "BCHUSDT",
        "TRXUSDT",
        "TONUSDT",
        "SUIUSDT"
    ],

    // Binance candle intervals

    TIMEFRAMES: {
        "1h": {
            label: "1 Hour",
            interval: "1h",
            candleLimit: 500
        },

        "4h": {
            label: "4 Hours",
            interval: "4h",
            candleLimit: 500
        },

        "1d": {
            label: "1 Day",
            interval: "1d",
            candleLimit: 500
        },

        "1w": {
            label: "1 Week",
            interval: "1w",
            candleLimit: 500
        }
    },

    // Technical indicator settings

    INDICATORS: {

        RSI: {
            PERIOD: 14,
            OVERSOLD: 30,
            OVERBOUGHT: 70
        },

        EMA: {
            SHORT: 9,
            MEDIUM: 20,
            LONG: 50
        },

        MACD: {
            FAST: 12,
            SLOW: 26,
            SIGNAL: 9
        },

        ATR: {
            PERIOD: 14
        },

        ADX: {
            PERIOD: 14,
            TREND_THRESHOLD: 25
        },

        BOLLINGER: {
            PERIOD: 20,
            DEVIATION: 2
        },

        STOCHASTIC_RSI: {
            RSI_PERIOD: 14,
            STOCHASTIC_PERIOD: 14,
            K_PERIOD: 3,
            D_PERIOD: 3
        }

    },

    // Forecast configuration

    FORECAST: {

        DEFAULT_HORIZON: 30,

        SUPPORTED_HORIZONS: [
            7,
            14,
            30
        ],

        MAX_DRIFT_PER_PERIOD: 0.02,

        CONFIDENCE_LEVEL: 0.95

    },

    // Risk management defaults
    // These are illustrative analytical parameters,
    // not personalized investment recommendations.

    RISK: {

        ATR_STOP_MULTIPLIER: 2,

        FIRST_TARGET_MULTIPLIER: 2,

        SECOND_TARGET_MULTIPLIER: 3,

        DEFAULT_RISK_REWARD: 2,

        MAX_POSITION_RISK_PERCENT: 1

    },

    // Market scanner

    SCANNER: {

        TOP_MARKETS: 50,

        MIN_QUOTE_VOLUME: 1000000,

        EXCLUDED_ASSETS: [
            "USDCUSDT",
            "FDUSDUSDT",
            "TUSDUSDT",
            "USDPUSDT",
            "BUSDUSDT"
        ],

        EXCLUDED_SUFFIXES: [
            "UPUSDT",
            "DOWNUSDT",
            "BULLUSDT",
            "BEARUSDT"
        ]

    },

    // Chart appearance

    CHART: {

        BACKGROUND: "#111c2d",

        TEXT_COLOR: "#91a4bd",

        GRID_COLOR: "#24364d",

        CANDLE_UP: "#32d49b",

        CANDLE_DOWN: "#ff637c",

        EMA_20: "#32d49b",

        EMA_50: "#e8c66b",

        CROSSHAIR_COLOR: "#91a4bd"

    }

};


// Helper: construct Binance API URLs

export function apiURL(endpoint, params = {}) {

    const url = new URL(
        CONFIG.API.BASE_URL + endpoint
    );

    Object.entries(params).forEach(([key, value]) => {

        if (value !== undefined && value !== null) {

            url.searchParams.set(key, value);

        }

    });

    return url.toString();

}


// Helper: validate supported timeframe

export function getTimeframe(value) {

    return CONFIG.TIMEFRAMES[value] ||
        CONFIG.TIMEFRAMES[CONFIG.DEFAULT_TIMEFRAME];

}


// Helper: validate cryptocurrency symbol

export function isSupportedAsset(symbol) {

    return CONFIG.SUPPORTED_ASSETS.includes(symbol);

}


// Helper: format prices

export function formatPrice(value) {

    if (!Number.isFinite(Number(value))) {
        return "—";
    }

    return Number(value).toLocaleString("en-US", {

        minimumFractionDigits: 2,

        maximumFractionDigits: 8

    });

}


// Helper: format percentages

export function formatPercent(value) {

    if (!Number.isFinite(Number(value))) {
        return "—";
    }

    const number = Number(value);

    return (number > 0 ? "+" : "") +
        number.toFixed(2) + "%";

}
