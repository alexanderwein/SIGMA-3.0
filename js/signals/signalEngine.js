
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

/* =====================================================
   ADX TREND STRENGTH ANALYSIS
===================================================== */

function analyzeADX(data) {

    if (!validNumber(data.adx)) {

        return {
            strength: 0,
            description: "ADX unavailable"
        };

    }

    if (data.adx >= 25) {

        return {
            strength: 2,
            description: "Strong trend"
        };

    }

    if (data.adx >= 20) {

        return {
            strength: 1,
            description: "Developing trend"
        };

    }

    return {
        strength: 0,
        description: "Weak trend"
    };

}


/* =====================================================
   SIGNAL SCORING
===================================================== */

function calculateScores(data) {

    let buyScore = 0;
    let sellScore = 0;

    const trend = analyzeTrend(data);
    const rsi = analyzeRSI(data);
    const macd = analyzeMACD(data);
    const volume = analyzeVolume(data);
    const adx = analyzeADX(data);

    // EMA trend

    if (trend === "BULLISH") {
        buyScore += 25;
    }

    if (trend === "BEARISH") {
        sellScore += 25;
    }

    // RSI momentum

    if (rsi.direction === "BULLISH") {
        buyScore += rsi.strength * 10;
    }

    if (rsi.direction === "BEARISH") {
        sellScore += rsi.strength * 10;
    }

    // MACD momentum

    if (macd.direction === "BULLISH") {
        buyScore += 20;
    }

    if (macd.direction === "BEARISH") {
        sellScore += 20;
    }

    // Volume confirmation

    if (volume.confirmed) {

        if (trend === "BULLISH") {
            buyScore += 10;
        }

        if (trend === "BEARISH") {
            sellScore += 10;
        }

    }

    // ADX trend strength

    if (adx.strength > 0) {

        if (trend === "BULLISH") {
            buyScore += adx.strength * 5;
        }

        if (trend === "BEARISH") {
            sellScore += adx.strength * 5;
        }

    }

    return {

        buyScore: Math.min(100, buyScore),

        sellScore: Math.min(100, sellScore),

        trend,

        rsi,

        macd,

        volume,

        adx

    };

}


/* =====================================================
   RISK MANAGEMENT
===================================================== */

function calculateRiskLevels(data) {

    const price = Number(data.price);

    const atr = validNumber(data.atr)
        ? Number(data.atr)
        : price * 0.02;

    if (price <= 0 || atr <= 0) {

        return null;

    }

    const stopDistance = atr * 2;

    const riskReward = 2;

    return {

        entry: price,

        stopLoss: price - stopDistance,

        takeProfit: price + stopDistance * riskReward,

        riskAmount: stopDistance,

        rewardAmount: stopDistance * riskReward,

        riskRewardRatio: riskReward

    };

}


/* =====================================================
   BEARISH RISK LEVELS
===================================================== */

function calculateShortRiskLevels(data) {

    const price = Number(data.price);

    const atr = validNumber(data.atr)
        ? Number(data.atr)
        : price * 0.02;

    if (price <= 0 || atr <= 0) {

        return null;

    }

    const stopDistance = atr * 2;

    const riskReward = 2;

    return {

        entry: price,

        stopLoss: price + stopDistance,

        takeProfit: price - stopDistance * riskReward,

        riskAmount: stopDistance,

        rewardAmount: stopDistance * riskReward,

        riskRewardRatio: riskReward

    };

}


/* =====================================================
   SIGNAL CONFIDENCE
===================================================== */

function calculateConfidence(buyScore, sellScore) {

    const difference = Math.abs(buyScore - sellScore);

    return Math.min(95, difference);

}

/* =====================================================
   MAIN SIGNAL GENERATOR
===================================================== */

export function generateSignal(data) {

    validateData(data);

    const scores = calculateScores(data);

    const buyScore = scores.buyScore;
    const sellScore = scores.sellScore;

    let signal = "HOLD";
    let explanation = "No sufficiently strong trading setup.";

    let risk = null;

    // BUY CONDITIONS

    if (
        buyScore >= SETTINGS.MIN_BUY_SCORE &&
        buyScore > sellScore &&
        scores.trend === "BULLISH"
    ) {

        signal = "BUY";

        explanation =
            "Bullish trend with supporting technical indicators.";

        risk = calculateRiskLevels(data);

    }

    // SELL CONDITIONS

    else if (
        sellScore >= SETTINGS.MIN_SELL_SCORE &&
        sellScore > buyScore &&
        scores.trend === "BEARISH"
    ) {

        signal = "SELL";

        explanation =
            "Bearish trend with supporting technical indicators.";

        risk = calculateShortRiskLevels(data);

    }

    // CONFLICTING INDICATORS

    else {

        explanation =
            "Indicators are conflicting or confirmation is insufficient.";

    }

    const confidence = calculateConfidence(
        buyScore,
        sellScore
    );

    return {

        signal,

        confidence,

        scores: {

            buy: buyScore,

            sell: sellScore

        },

        trend: scores.trend,

        indicators: {

            rsi: scores.rsi,

            macd: scores.macd,

            volume: scores.volume,

            adx: scores.adx

        },

        risk,

        explanation,

        timestamp: Date.now()

    };

}


/* =====================================================
   SIGNAL HISTORY
===================================================== */

const signalHistory = [];

export function saveSignal(result) {

    if (!result || !result.signal) {
        return;
    }

    signalHistory.push(result);

    // Keep the latest 200 signals

    if (signalHistory.length > 200) {

        signalHistory.shift();

    }

}


export function getSignalHistory() {

    return [...signalHistory];

}


/* =====================================================
   SIGNAL ENGINE SETTINGS
===================================================== */

export function getSignalSettings() {

    return {

        ...SETTINGS

    };

}


/* =====================================================
   RESET SIGNAL HISTORY
===================================================== */

export function clearSignalHistory() {

    signalHistory.length = 0;

}
