
/*
=========================================================
 SIGMA 3.0 — FORECAST ENGINE
 PART 1: DATA VALIDATION AND STATISTICS
=========================================================
*/

const FORECAST_SETTINGS = {

    DEFAULT_HORIZON: 7,

    MAX_HORIZON: 90,

    MIN_CANDLES: 60,

    VOLATILITY_MULTIPLIER: 1.5,

    MAX_DRIFT: 0.03,

    MIN_DRIFT: -0.03

};


/* =====================================================
   VALIDATION
===================================================== */

function validateCandles(candles) {

    if (!Array.isArray(candles)) {

        throw new Error("Invalid candle data.");

    }

    if (candles.length < FORECAST_SETTINGS.MIN_CANDLES) {

        throw new Error(
            "At least 60 historical candles are required."
        );

    }

    for (const candle of candles) {

        if (
            !Number.isFinite(candle.close) ||
            candle.close <= 0 ||
            !Number.isFinite(candle.high) ||
            !Number.isFinite(candle.low) ||
            candle.high < candle.low
        ) {

            throw new Error("Invalid historical candle.");

        }

    }

    return true;

}


/* =====================================================
   EXPONENTIAL MOVING AVERAGE
===================================================== */

function calculateEMA(values, period) {

    if (!values.length) return [];

    const multiplier = 2 / (period + 1);

    let previous = values[0];

    return values.map((value, index) => {

        if (index === 0) {

            return previous;

        }

        previous =
            value * multiplier +
            previous * (1 - multiplier);

        return previous;

    });

}


/* =====================================================
   HISTORICAL RETURNS
===================================================== */

function calculateReturns(prices) {

    const returns = [];

    for (let i = 1; i < prices.length; i++) {

        returns.push(
            Math.log(prices[i] / prices[i - 1])
        );

    }

    return returns;

}


/* =====================================================
   HISTORICAL VOLATILITY
===================================================== */

function calculateVolatility(returns) {

    if (returns.length < 2) {

        return 0;

    }

    const mean = returns.reduce(
        (sum, value) => sum + value,
        0
    ) / returns.length;

    const variance = returns.reduce(
        (sum, value) => sum + Math.pow(value - mean, 2),
        0
    ) / (returns.length - 1);

    return Math.sqrt(variance);

}


/* =====================================================
   AVERAGE TRUE RANGE
===================================================== */

function calculateATR(candles, period = 14) {

    const ranges = [];

    for (let i = 1; i < candles.length; i++) {

        const current = candles[i];

        const previous = candles[i - 1];

        const trueRange = Math.max(

            current.high - current.low,

            Math.abs(current.high - previous.close),

            Math.abs(current.low - previous.close)

        );

        ranges.push(trueRange);

    }

    const recent = ranges.slice(-period);

    if (!recent.length) return 0;

    return recent.reduce(
        (sum, value) => sum + value,
        0
    ) / recent.length;

}

/* =====================================================
   TREND ESTIMATION
===================================================== */

function calculateTrend(prices) {

    const ema20 = calculateEMA(prices, 20);

    const ema50 = calculateEMA(prices, 50);

    const last = prices.length - 1;

    const shortTrend =
        (ema20[last] / ema20[last - 5] - 1) / 5;

    const longTrend =
        (ema50[last] / ema50[last - 10] - 1) / 10;

    // Combine short and long trends.

    let drift =
        shortTrend * 0.65 +
        longTrend * 0.35;

    // Limit extrapolation.

    drift = Math.max(
        FORECAST_SETTINGS.MIN_DRIFT,
        Math.min(
            FORECAST_SETTINGS.MAX_DRIFT,
            drift
        )
    );

    return {
        ema20,
        ema50,
        drift
    };

}


/* =====================================================
   FORECAST DIRECTION
===================================================== */

function calculateDirection(
    prices,
    indicators
) {

    const last = prices.length - 1;

    let score = 0;

    if (indicators.ema20[last] > indicators.ema50[last]) {
        score += 1;
    } else {
        score -= 1;
    }

    if (indicators.rsi > 50) {
        score += 1;
    } else if (indicators.rsi < 50) {
        score -= 1;
    }

    if (indicators.macd > indicators.macdSignal) {
        score += 1;
    } else {
        score -= 1;
    }

    if (score >= 2) return "BULLISH";

    if (score <= -2) return "BEARISH";

    return "NEUTRAL";

}


/* =====================================================
   VOLATILITY-BASED PRICE RANGE
===================================================== */

function calculatePriceRange(
    currentPrice,
    drift,
    volatility,
    horizon
) {

    const expectedPrice =
        currentPrice * Math.exp(drift * horizon);

    const uncertainty =
        FORECAST_SETTINGS.VOLATILITY_MULTIPLIER *
        volatility *
        Math.sqrt(horizon);

    const lower =
        expectedPrice * Math.exp(-uncertainty);

    const upper =
        expectedPrice * Math.exp(uncertainty);

    return {

        expected: expectedPrice,

        lower,

        upper

    };

}


/* =====================================================
   BUILD FORECAST POINTS
===================================================== */

function buildForecastPoints(
    candles,
    drift,
    volatility,
    horizon
) {

    const currentPrice =
        candles[candles.length - 1].close;

    const lastTime =
        candles[candles.length - 1].time;

    // Forecast timestamps use candle spacing.

    const intervalSeconds =
        candles.length > 1
            ? candles[candles.length - 1].time -
              candles[candles.length - 2].time
            : 86400;

    const points = [];

    for (let i = 0; i <= horizon; i++) {

        const range = calculatePriceRange(
            currentPrice,
            drift,
            volatility,
            i
        );

        points.push({

            time: lastTime + intervalSeconds * i,

            expected: range.expected,

            lower: range.lower,

            upper: range.upper

        });

    }

    return points;

}


/* =====================================================
   BULLISH AND BEARISH SCENARIOS
===================================================== */

function calculateScenarios(
    currentPrice,
    drift,
    volatility,
    horizon
) {

    const bullishDrift = Math.max(
        0,
        drift + volatility * 0.25
    );

    const bearishDrift = Math.min(
        0,
        drift - volatility * 0.25
    );

    return {

        bullish:
            currentPrice *
            Math.exp(bullishDrift * horizon),

        neutral:
            currentPrice *
            Math.exp(drift * horizon),

        bearish:
            currentPrice *
            Math.exp(bearishDrift * horizon)

    };

}

/* =====================================================
   MAIN FORECAST GENERATOR
===================================================== */

export function generateForecast(
    candles,
    indicators = {},
    requestedHorizon = FORECAST_SETTINGS.DEFAULT_HORIZON
) {

    validateCandles(candles);

    const horizon = Math.max(
        1,
        Math.min(
            FORECAST_SETTINGS.MAX_HORIZON,
            Math.floor(Number(requestedHorizon) || 7)
        )
    );

    const prices = candles.map(
        candle => candle.close
    );

    const currentPrice =
        prices[prices.length - 1];

    // Trend estimation

    const trend = calculateTrend(prices);

    // Historical returns

    const returns = calculateReturns(prices);

    // Volatility

    const volatility = calculateVolatility(
        returns.slice(-30)
    );

    // ATR

    const atr = calculateATR(candles);

    // Forecast direction

    const direction = calculateDirection(
        prices,
        {
            ...trend,

            rsi: Number.isFinite(indicators.rsi)
                ? indicators.rsi
                : 50,

            macd: Number.isFinite(indicators.macd)
                ? indicators.macd
                : 0,

            macdSignal: Number.isFinite(indicators.macdSignal)
                ? indicators.macdSignal
                : 0
        }
    );

    // Expected price range

    const range = calculatePriceRange(
        currentPrice,
        trend.drift,
        volatility,
        horizon
    );

    // Scenarios

    const scenarios = calculateScenarios(
        currentPrice,
        trend.drift,
        volatility,
        horizon
    );

    // Forecast chart points

    const points = buildForecastPoints(
        candles,
        trend.drift,
        volatility,
        horizon
    );

    return {

        symbol: indicators.symbol || "UNKNOWN",

        currentPrice,

        horizon,

        direction,

        expectedPrice: range.expected,

        lowerRange: range.lower,

        upperRange: range.upper,

        bullishScenario: scenarios.bullish,

        neutralScenario: scenarios.neutral,

        bearishScenario: scenarios.bearish,

        volatility,

        atr,

        dailyDrift: trend.drift,

        ema20: trend.ema20.at(-1),

        ema50: trend.ema50.at(-1),

        points,

        timestamp: Date.now(),

        disclaimer:
            "Experimental statistical forecast. Not financial advice."

    };

}


/* =====================================================
   FORECAST SUMMARY
===================================================== */

export function getForecastSummary(forecast) {

    if (!forecast) {

        return null;

    }

    const difference =
        forecast.expectedPrice -
        forecast.currentPrice;

    const percentage =
        (difference / forecast.currentPrice) * 100;

    return {

        direction: forecast.direction,

        expectedChange: difference,

        expectedChangePercent: percentage,

        expectedPrice: forecast.expectedPrice,

        lowerRange: forecast.lowerRange,

        upperRange: forecast.upperRange,

        horizon: forecast.horizon

    };

}


/* =====================================================
   FORECAST SETTINGS
===================================================== */

export function getForecastSettings() {

    return {

        ...FORECAST_SETTINGS

    };

}
