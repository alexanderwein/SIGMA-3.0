
/*
=========================================================
 SIGMA 3.0 — BACKTEST ENGINE
 CONFIGURATION AND TRADE SIMULATION
=========================================================
*/

const BACKTEST_SETTINGS = Object.freeze({

    INITIAL_CAPITAL: 10000,

    POSITION_SIZE: 0.10,

    FEE_RATE: 0.001,

    SLIPPAGE_RATE: 0.0005,

    STOP_ATR_MULTIPLIER: 2,

    TAKE_PROFIT_MULTIPLIER: 4,

    MIN_CANDLES: 100,

    MAX_HISTORY: 5000

});


/* =====================================================
   VALIDATION
===================================================== */

function validateBacktestData(candles) {

    if (!Array.isArray(candles)) {
        throw new Error("Invalid backtest data.");
    }

    if (candles.length < BACKTEST_SETTINGS.MIN_CANDLES) {
        throw new Error(
            "At least 100 historical candles are required."
        );
    }

    if (candles.length > BACKTEST_SETTINGS.MAX_HISTORY) {
        throw new Error(
            "Historical data exceeds maximum allowed candles."
        );
    }

    for (let i = 0; i < candles.length; i++) {

        const candle = candles[i];

        if (!candle || typeof candle !== "object") {
            throw new Error("Invalid historical candle.");
        }

        const values = [
            candle.open,
            candle.high,
            candle.low,
            candle.close
        ];

        if (!values.every(Number.isFinite)) {
            throw new Error("Invalid historical candle values.");
        }

        if (
            candle.low <= 0 ||
            candle.high < candle.low ||
            candle.open < candle.low ||
            candle.open > candle.high ||
            candle.close < candle.low ||
            candle.close > candle.high
        ) {
            throw new Error("Inconsistent historical candle.");
        }

        if (
            candle.volume !== undefined &&
            (!Number.isFinite(candle.volume) || candle.volume < 0)
        ) {
            throw new Error("Invalid historical candle volume.");
        }

        if (
            candle.time !== undefined &&
            !Number.isFinite(candle.time)
        ) {
            throw new Error("Invalid candle timestamp.");
        }

        if (
            i > 0 &&
            candle.time !== undefined &&
            candles[i - 1].time !== undefined &&
            candle.time <= candles[i - 1].time
        ) {
            throw new Error("Candle timestamps must be increasing.");
        }

    }

    return true;

}


/* =====================================================
   EXPONENTIAL MOVING AVERAGE
===================================================== */

function calculateEMA(values, period) {

    if (
        !Array.isArray(values) ||
        !values.length ||
        !Number.isInteger(period) ||
        period < 1
    ) {
        throw new Error("Invalid EMA parameters.");
    }

    const multiplier = 2 / (period + 1);

    let previous = values[0];

    return values.map((value, index) => {

        if (!Number.isFinite(value)) {
            throw new Error("Invalid EMA input.");
        }

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
   RSI CALCULATION
===================================================== */

function calculateRSI(values, period = 14) {

    if (
        !Array.isArray(values) ||
        !Number.isInteger(period) ||
        period < 1
    ) {
        throw new Error("Invalid RSI parameters.");
    }

    const result = Array(values.length).fill(50);

    if (values.length <= period) {
        return result;
    }

    for (let i = period; i < values.length; i++) {

        let gains = 0;
        let losses = 0;

        for (
            let j = i - period + 1;
            j <= i;
            j++
        ) {

            const difference =
                values[j] - values[j - 1];

            if (difference > 0) {
                gains += difference;
            } else {
                losses -= difference;
            }

        }

        if (losses === 0) {

            result[i] = gains === 0 ? 50 : 100;

            continue;

        }

        const rs = gains / losses;

        result[i] = 100 - (100 / (1 + rs));

    }

    return result;

}


/* =====================================================
   MACD CALCULATION
===================================================== */

function calculateMACD(values) {

    const fast = calculateEMA(values, 12);

    const slow = calculateEMA(values, 26);

    const line = values.map(
        (_, index) => fast[index] - slow[index]
    );

    const signal = calculateEMA(line, 9);

    const histogram = line.map(
        (value, index) => value - signal[index]
    );

    return {
        line,
        signal,
        histogram
    };

}


/* =====================================================
   ATR CALCULATION
===================================================== */

function calculateATR(candles, period = 14) {

    if (
        !Array.isArray(candles) ||
        !Number.isInteger(period) ||
        period < 1
    ) {
        throw new Error("Invalid ATR parameters.");
    }

    return candles.map((candle, index) => {

        if (index === 0) {
            return candle.high - candle.low;
        }

        let sum = 0;

        const start = Math.max(1, index - period + 1);

        for (let j = start; j <= index; j++) {

            const current = candles[j];

            const previous = candles[j - 1];

            sum += Math.max(

                current.high - current.low,

                Math.abs(current.high - previous.close),

                Math.abs(current.low - previous.close)

            );

        }

        return sum / (index - start + 1);

    });

}


/* =====================================================
   TRADE EXECUTION PRICE
===================================================== */

function executionPrice(price, direction) {

    if (
        !Number.isFinite(price) ||
        price <= 0
    ) {
        throw new Error("Invalid execution price.");
    }

    const adjustment =
        BACKTEST_SETTINGS.SLIPPAGE_RATE;

    if (direction === "BUY") {

        return price * (1 + adjustment);

    }

    if (direction === "SELL") {

        return price * (1 - adjustment);

    }

    throw new Error("Invalid execution direction.");

}


/* =====================================================
   TRADING FEES
===================================================== */

function calculateFee(notional) {

    if (
        !Number.isFinite(notional) ||
        notional < 0
    ) {
        throw new Error("Invalid trading notional.");
    }

    return notional * BACKTEST_SETTINGS.FEE_RATE;

}


/* =====================================================
   GENERATE HISTORICAL INDICATORS
===================================================== */

function calculateIndicators(candles) {

    const prices = candles.map(c => c.close);

    const ema20 = calculateEMA(prices, 20);

    const ema50 = calculateEMA(prices, 50);

    const rsi = calculateRSI(prices, 14);

    const macd = calculateMACD(prices);

    const atr = calculateATR(candles, 14);

    return {
        ema20,
        ema50,
        rsi,
        macd,
        atr
    };

}


/* =====================================================
   HISTORICAL SIGNAL GENERATOR
===================================================== */

function historicalSignal(data, index) {

    if (
        !data ||
        index < 50 ||
        index >= data.ema20.length
    ) {
        return "HOLD";
    }

    const bullishTrend =
        data.ema20[index] > data.ema50[index];

    const bearishTrend =
        data.ema20[index] < data.ema50[index];

    const bullishMACD =
        data.macd.line[index] >
        data.macd.signal[index];

    const bearishMACD =
        data.macd.line[index] <
        data.macd.signal[index];

    const rsi = data.rsi[index];

    if (
        bullishTrend &&
        bullishMACD &&
        rsi > 50 &&
        rsi < 70
    ) {
        return "BUY";
    }

    if (
        bearishTrend &&
        bearishMACD &&
        rsi < 50 &&
        rsi > 30
    ) {
        return "SELL";
    }

    return "HOLD";

}


/* =====================================================
   OPEN TRADE
===================================================== */

function openTrade(
    direction,
    candle,
    atr,
    capital,
    index
) {

    if (!["BUY", "SELL"].includes(direction)) {
        throw new Error("Invalid trade direction.");
    }

    if (
        !Number.isFinite(capital) ||
        capital <= 0 ||
        !Number.isFinite(atr) ||
        atr <= 0
    ) {
        throw new Error("Invalid trade parameters.");
    }

    const rawPrice = candle.close;

    const entry = executionPrice(
        rawPrice,
        direction === "BUY" ? "BUY" : "SELL"
    );

    const allocation =
        capital * BACKTEST_SETTINGS.POSITION_SIZE;

    if (allocation <= 0) {
        throw new Error("Invalid position allocation.");
    }

    const quantity = allocation / entry;

    const entryFee = calculateFee(
        allocation
    );

    const stopDistance =
        atr * BACKTEST_SETTINGS.STOP_ATR_MULTIPLIER;

    const targetDistance =
        atr * BACKTEST_SETTINGS.TAKE_PROFIT_MULTIPLIER;

    const isLong = direction === "BUY";

    return {

        direction,

        entry,

        quantity,

        allocation,

        entryFee,

        entryIndex: index,

        stopLoss: isLong
            ? entry - stopDistance
            : entry + stopDistance,

        takeProfit: isLong
            ? entry + targetDistance
            : entry - targetDistance

    };

}


/* =====================================================
   CLOSE TRADE
===================================================== */

function closeTrade(
    trade,
    rawExitPrice,
    index,
    reason
) {

    if (
        !trade ||
        !Number.isFinite(rawExitPrice) ||
        rawExitPrice <= 0
    ) {
        throw new Error("Invalid trade exit parameters.");
    }

    if (index < trade.entryIndex) {
        throw new Error("Invalid trade exit index.");
    }

    const exit = executionPrice(
        rawExitPrice,
        trade.direction === "BUY" ? "SELL" : "BUY"
    );

    const exitNotional =
        trade.quantity * exit;

    const exitFee = calculateFee(
        exitNotional
    );

    const grossProfit = trade.direction === "BUY"

        ? (exit - trade.entry) * trade.quantity

        : (trade.entry - exit) * trade.quantity;

    const totalFees =
        trade.entryFee + exitFee;

    const netProfit =
        grossProfit - totalFees;

    return {

        direction: trade.direction,

        entry: trade.entry,

        exit,

        quantity: trade.quantity,

        grossProfit,

        fees: totalFees,

        netProfit,

        entryIndex: trade.entryIndex,

        exitIndex: index,

        candlesHeld: index - trade.entryIndex,

        reason

    };

}


/* =====================================================
   CHECK STOP LOSS AND TAKE PROFIT
===================================================== */

function checkExit(trade, candle) {

    if (!trade || !candle) {
        return null;
    }

    if (trade.direction === "BUY") {

        const stopHit =
            candle.low <= trade.stopLoss;

        const targetHit =
            candle.high >= trade.takeProfit;

        // Conservative assumption:
        // Stop-loss takes priority if both levels
        // are touched during the same candle.

        if (stopHit) {

            return {
                price: trade.stopLoss,
                reason: "STOP_LOSS"
            };

        }

        if (targetHit) {

            return {
                price: trade.takeProfit,
                reason: "TAKE_PROFIT"
            };

        }

    } else if (trade.direction === "SELL") {

        const stopHit =
            candle.high >= trade.stopLoss;

        const targetHit =
            candle.low <= trade.takeProfit;

        if (stopHit) {

            return {
                price: trade.stopLoss,
                reason: "STOP_LOSS"
            };

        }

        if (targetHit) {

            return {
                price: trade.takeProfit,
                reason: "TAKE_PROFIT"
            };

        }

    }

    return null;

}


/* =====================================================
   EXPORT SETTINGS
===================================================== */

export function getBacktestSettings() {

    return {
        ...BACKTEST_SETTINGS
    };

}
