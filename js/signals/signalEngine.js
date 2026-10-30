
/*
=========================================================
 SIGMA 3.0
 SIGNAL ENGINE
 PART 1: CONFIGURATION AND INDICATOR ANALYSIS
=========================================================
*/

const SETTINGS = {
    RSI_OVERSOLD: 30,
    RSI_OVERBOUGHT: 70,

    MIN_BUY_SCORE: 65,
    MIN_SELL_SCORE: 65,

    MIN_VOLUME_RATIO: 1.2,

    EMA_FAST: 20,
    EMA_SLOW: 50,

    MIN_DATA_POINTS: 60
};


/* =====================================================
   VALIDATION
===================================================== */

function validNumber(value) {
    return Number.isFinite(Number(value));
}


function validateData(data) {

    if (!data || typeof data !== "object") {
        throw new Error("Invalid signal data.");
    }

    const required = [
        "price",
        "rsi",
        "macd",
        "macdSignal",
        "ema20",
        "ema50"
    ];

    for (const key of required) {

        if (!validNumber(data[key])) {
            throw new Error(
                "Missing or invalid indicator: " + key
            );
        }

    }

    return true;
}


/* =====================================================
   TREND ANALYSIS
===================================================== */

function analyzeTrend(data) {

    const bullish =
        data.price > data.ema20 &&
        data.ema20 > data.ema50;

    const bearish =
        data.price < data.ema20 &&
        data.ema20 < data.ema50;

    if (bullish) {
        return "BULLISH";
    }

    if (bearish) {
        return "BEARISH";
    }

    return "SIDEWAYS";

}


/* =====================================================
   RSI ANALYSIS
===================================================== */

function analyzeRSI(data) {

    if (data.rsi <= SETTINGS.RSI_OVERSOLD) {

        return {
            direction: "BULLISH",
            strength: 2,
            description: "RSI oversold"
        };

    }

    if (data.rsi >= SETTINGS.RSI_OVERBOUGHT) {

        return {
            direction: "BEARISH",
            strength: 2,
            description: "RSI overbought"
        };

    }

    if (data.rsi > 50) {

        return {
            direction: "BULLISH",
            strength: 1,
            description: "RSI positive momentum"
        };

    }

    return {
        direction: "BEARISH",
        strength: 1,
        description: "RSI negative momentum"
    };

}


/* =====================================================
   MACD ANALYSIS
===================================================== */

function analyzeMACD(data) {

    if (data.macd > data.macdSignal) {

        return {
            direction: "BULLISH",
            strength: 2,
            description: "MACD above signal"
        };

    }

    if (data.macd < data.macdSignal) {

        return {
            direction: "BEARISH",
            strength: 2,
            description: "MACD below signal"
        };

    }

    return {
        direction: "NEUTRAL",
        strength: 0,
        description: "MACD neutral"
    };

}


/* =====================================================
   VOLUME ANALYSIS
===================================================== */

function analyzeVolume(data) {

    if (
        !validNumber(data.volume) ||
        !validNumber(data.averageVolume) ||
        data.averageVolume <= 0
    ) {

        return {
            confirmed: false,
            ratio: null,
            description: "Volume unavailable"
        };

    }

    const ratio = data.volume / data.averageVolume;

    return {
        confirmed: ratio >= SETTINGS.MIN_VOLUME_RATIO,
        ratio,
        description: ratio >= SETTINGS.MIN_VOLUME_RATIO
            ? "Volume confirmation"
            : "Weak volume"
    };

}
