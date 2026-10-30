
/*
=========================================================
 SIGMA 3.0 — BACKTEST ENGINE
 PART 1: CONFIGURATION AND TRADE SIMULATION
=========================================================
*/

const BACKTEST_SETTINGS = {

    INITIAL_CAPITAL: 10000,

    POSITION_SIZE: 0.10,

    FEE_RATE: 0.001,

    SLIPPAGE_RATE: 0.0005,

    STOP_ATR_MULTIPLIER: 2,

    TAKE_PROFIT_MULTIPLIER: 4,

    MIN_CANDLES: 100,

    MAX_HISTORY: 5000

};


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

    for (const candle of candles) {

        if (
            !Number.isFinite(candle.open) ||
            !Number.isFinite(candle.high) ||
            !Number.isFinite(candle.low) ||
            !Number.isFinite(candle.close) ||
            candle.low <= 0 ||
            candle.high < candle.low
        ) {

            throw new Error("Invalid historical candle.");

        }

    }

}


/* =====================================================
   EXPONENTIAL MOVING AVERAGE
===================================================== */

function calculateEMA(values, period) {

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
   RSI CALCULATION
===================================================== */

function calculateRSI(values, period = 14) {

    return values.map((value, index) => {

        if (index < period) return 50;

        let gains = 0;
        let losses = 0;

        for (
            let j = index - period + 1;
            j <= index;
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

        if (losses === 0) return 100;

        const rs = gains / losses;

        return 100 - (100 / (1 + rs));

    });

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

    return {
        line,
        signal
    };

}


/* =====================================================
   ATR CALCULATION
===================================================== */

function calculateATR(candles, period = 14) {

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

    const adjustment =
        BACKTEST_SETTINGS.SLIPPAGE_RATE;

    return direction === "BUY"

        ? price * (1 + adjustment)

        : price * (1 - adjustment);

}


/* =====================================================
   TRADING FEES
===================================================== */

function calculateFee(notional) {

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

    if (index < 50) return "HOLD";

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

    const rawPrice = candle.close;

    const entry = executionPrice(
        rawPrice,
        direction === "BUY" ? "BUY" : "SELL"
    );

    const allocation =
        capital * BACKTEST_SETTINGS.POSITION_SIZE;

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

    const netProfit =
        grossProfit -
        trade.entryFee -
        exitFee;

    return {

        direction: trade.direction,

        entry: trade.entry,

        exit,

        quantity: trade.quantity,

        grossProfit,

        fees: trade.entryFee + exitFee,

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

    if (trade.direction === "BUY") {

        const stopHit =
            candle.low <= trade.stopLoss;

        const targetHit =
            candle.high >= trade.takeProfit;

        // Conservative assumption:
        // If both levels are touched in one candle,
        // assume stop-loss happened first.

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

    } else {

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

    if (index < 50) return "HOLD";

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

    const rawPrice = candle.close;

    const entry = executionPrice(
        rawPrice,
        direction === "BUY" ? "BUY" : "SELL"
    );

    const allocation =
        capital * BACKTEST_SETTINGS.POSITION_SIZE;

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

    const netProfit =
        grossProfit -
        trade.entryFee -
        exitFee;

    return {

        direction: trade.direction,

        entry: trade.entry,

        exit,

        quantity: trade.quantity,

        grossProfit,

        fees: trade.entryFee + exitFee,

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

    if (trade.direction === "BUY") {

        const stopHit =
            candle.low <= trade.stopLoss;

        const targetHit =
            candle.high >= trade.takeProfit;

        // Conservative assumption:
        // If both levels are touched in one candle,
        // assume stop-loss happened first.

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

    } else {

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
