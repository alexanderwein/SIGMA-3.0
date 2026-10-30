
/*
=========================================================
 SIGMA 3.0 — BACKTEST ENGINE
 PART 1: CONFIGURATION, VALIDATION AND INDICATORS
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

    MAX_HISTORY: 5000,

    RSI_PERIOD: 14,

    ATR_PERIOD: 14,

    EMA_FAST: 20,

    EMA_SLOW: 50

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

    if (candles.length > BACKTEST_SETTINGS.MAX_HISTORY) {
        throw new Error(
            "Maximum historical candle limit exceeded."
        );
    }

    let previousTime = -Infinity;

    for (const candle of candles) {

        if (!candle || typeof candle !== "object") {
            throw new Error("Invalid historical candle.");
        }

        const {
            open,
            high,
            low,
            close
        } = candle;

        if (
            !Number.isFinite(open) ||
            !Number.isFinite(high) ||
            !Number.isFinite(low) ||
            !Number.isFinite(close)
        ) {
            throw new Error(
                "Historical candle contains invalid prices."
            );
        }

        if (
            low <= 0 ||
            high < low ||
            open < low ||
            open > high ||
            close < low ||
            close > high
        ) {
            throw new Error(
                "Inconsistent historical candle."
            );
        }

        if (candle.time !== undefined) {

            if (
                !Number.isFinite(candle.time) ||
                candle.time <= previousTime
            ) {
                throw new Error(
                    "Invalid or unordered candle timestamps."
                );
            }

            previousTime = candle.time;

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

    const result = Array(values.length).fill(null);

    if (values.length < period) {
        return result;
    }

    const multiplier = 2 / (period + 1);

    let initial = 0;

    for (let i = 0; i < period; i++) {

        initial += values[i];

    }

    let previous = initial / period;

    result[period - 1] = previous;

    for (let i = period; i < values.length; i++) {

        previous =
            values[i] * multiplier +
            previous * (1 - multiplier);

        result[i] = previous;

    }

    return result;

}


/* =====================================================
   RELATIVE STRENGTH INDEX — WILDER
===================================================== */

function calculateRSI(values, period = 14) {

    const result = Array(values.length).fill(null);

    if (values.length <= period) {
        return result;
    }

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {

        const change = values[i] - values[i - 1];

        if (change > 0) {
            gains += change;
        } else {
            losses -= change;
        }

    }

    let averageGain = gains / period;
    let averageLoss = losses / period;

    function calculateValue() {

        if (averageLoss === 0) {

            return averageGain === 0 ? 50 : 100;

        }

        const rs = averageGain / averageLoss;

        return 100 - (100 / (1 + rs));

    }

    result[period] = calculateValue();

    for (let i = period + 1; i < values.length; i++) {

        const change = values[i] - values[i - 1];

        const gain = Math.max(change, 0);
        const loss = Math.max(-change, 0);

        averageGain =
            (averageGain * (period - 1) + gain) / period;

        averageLoss =
            (averageLoss * (period - 1) + loss) / period;

        result[i] = calculateValue();

    }

    return result;

}


/* =====================================================
   MACD CALCULATION
===================================================== */

function calculateMACD(values) {

    const fast = calculateEMA(values, 12);
    const slow = calculateEMA(values, 26);

    const line = Array(values.length).fill(null);

    for (let i = 25; i < values.length; i++) {

        line[i] = fast[i] - slow[i];

    }

    const validLine = line.slice(25);

    const validSignal = calculateEMA(validLine, 9);

    const signal = Array(values.length).fill(null);
    const histogram = Array(values.length).fill(null);

    for (let i = 0; i < validSignal.length; i++) {

        const index = 25 + i;

        signal[index] = validSignal[i];

        if (signal[index] !== null) {

            histogram[index] =
                line[index] - signal[index];

        }

    }

    return {
        line,
        signal,
        histogram
    };

}


/* =====================================================
   AVERAGE TRUE RANGE — WILDER
===================================================== */

function calculateATR(candles, period = 14) {

    const result = Array(candles.length).fill(null);

    if (candles.length <= period) {
        return result;
    }

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

    let initial = 0;

    for (let i = 0; i < period; i++) {

        initial += ranges[i];

    }

    let previousATR = initial / period;

    result[period] = previousATR;

    for (let i = period + 1; i < candles.length; i++) {

        previousATR = (

            previousATR * (period - 1) +
            ranges[i - 1]

        ) / period;

        result[i] = previousATR;

    }

    return result;

}


/* =====================================================
   GENERATE HISTORICAL INDICATORS
===================================================== */

function calculateIndicators(candles) {

    const prices = candles.map(
        candle => candle.close
    );

    const ema20 = calculateEMA(prices, 20);

    const ema50 = calculateEMA(prices, 50);

    const rsi = calculateRSI(
        prices,
        BACKTEST_SETTINGS.RSI_PERIOD
    );

    const macd = calculateMACD(prices);

    const atr = calculateATR(
        candles,
        BACKTEST_SETTINGS.ATR_PERIOD
    );

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
        index < 50 ||
        data.ema20[index] === null ||
        data.ema50[index] === null ||
        data.rsi[index] === null ||
        data.macd.line[index] === null ||
        data.macd.signal[index] === null
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
   TRADE EXECUTION PRICE
===================================================== */

function executionPrice(price, direction) {

    const slippage = BACKTEST_SETTINGS.SLIPPAGE_RATE;

    if (direction === "BUY") {
        return price * (1 + slippage);
    }

    return price * (1 - slippage);

}


/* =====================================================
   TRADING FEES
===================================================== */

function calculateFee(notional) {

    return notional * BACKTEST_SETTINGS.FEE_RATE;

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
        !Number.isFinite(atr) ||
        atr <= 0 ||
        !Number.isFinite(capital) ||
        capital <= 0
    ) {
        return null;
    }

    const rawPrice = candle.close;

    const entry = executionPrice(
        rawPrice,
        direction
    );

    const allocation =
        capital * BACKTEST_SETTINGS.POSITION_SIZE;

    const quantity = allocation / entry;

    const entryFee = calculateFee(allocation);

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

    if (!trade) {
        throw new Error("Invalid trade.");
    }

    if (
        !Number.isFinite(rawExitPrice) ||
        rawExitPrice <= 0
    ) {
        throw new Error("Invalid exit price.");
    }

    const exit = executionPrice(
        rawExitPrice,
        trade.direction === "BUY" ? "SELL" : "BUY"
    );

    const exitNotional =
        trade.quantity * exit;

    const exitFee = calculateFee(exitNotional);

    const grossProfit = trade.direction === "BUY"

        ? (exit - trade.entry) * trade.quantity

        : (trade.entry - exit) * trade.quantity;

    const totalFees = trade.entryFee + exitFee;

    const netProfit = grossProfit - totalFees;

    return {

        direction: trade.direction,

        entry: trade.entry,

        exit,

        quantity: trade.quantity,

        allocation: trade.allocation,

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
        // Stop-loss takes priority when both levels
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
   FORCE CLOSE AT MARKET
===================================================== */

function forceCloseTrade(
    trade,
    candle,
    index
) {

    return closeTrade(
        trade,
        candle.close,
        index,
        "END_OF_BACKTEST"
    );

}


/* =====================================================
   VALIDATE TRADE RESULT
===================================================== */

function validateTradeResult(trade) {

    if (!trade) {
        throw new Error("Invalid trade result.");
    }

    const required = [

        trade.entry,
        trade.exit,
        trade.quantity,
        trade.grossProfit,
        trade.fees,
        trade.netProfit

    ];

    if (!required.every(Number.isFinite)) {

        throw new Error(
            "Trade result contains invalid values."
        );

    }

    return true;

}


/* =====================================================
   UPDATE EQUITY
===================================================== */

function updateEquity(capital, trade) {

    if (
        !Number.isFinite(capital) ||
        !trade ||
        !Number.isFinite(trade.netProfit)
    ) {
        throw new Error("Invalid equity calculation.");
    }

    return capital + trade.netProfit;

}


/* =====================================================
   CALCULATE UNREALIZED PROFIT
===================================================== */

function calculateUnrealizedProfit(trade, price) {

    if (!trade || !Number.isFinite(price)) {
        return 0;
    }

    const exit = executionPrice(
        price,
        trade.direction === "BUY" ? "SELL" : "BUY"
    );

    const grossProfit = trade.direction === "BUY"

        ? (exit - trade.entry) * trade.quantity

        : (trade.entry - exit) * trade.quantity;

    const estimatedExitFee = calculateFee(
        trade.quantity * exit
    );

    return (
        grossProfit -
        trade.entryFee -
        estimatedExitFee
    );

}


/* =====================================================
   EQUITY DRAWDOWN
===================================================== */

function calculateDrawdown(equity, peak) {

    if (
        !Number.isFinite(equity) ||
        !Number.isFinite(peak) ||
        peak <= 0
    ) {
        return 0;
    }

    return Math.max(
        0,
        ((peak - equity) / peak) * 100
    );

}

/* =====================================================
   PERFORMANCE STATISTICS
===================================================== */

function calculateStatistics(
    initialCapital,
    finalCapital,
    trades,
    equityCurve,
    maxDrawdown
) {

    const totalTrades = trades.length;

    const winningTrades = trades.filter(
        trade => trade.netProfit > 0
    );

    const losingTrades = trades.filter(
        trade => trade.netProfit < 0
    );

    const grossProfit = winningTrades.reduce(
        (sum, trade) => sum + trade.netProfit,
        0
    );

    const grossLoss = Math.abs(
        losingTrades.reduce(
            (sum, trade) => sum + trade.netProfit,
            0
        )
    );

    const totalFees = trades.reduce(
        (sum, trade) => sum + trade.fees,
        0
    );

    const netProfit = finalCapital - initialCapital;

    const returnPercentage =
        (netProfit / initialCapital) * 100;

    const winRate = totalTrades > 0

        ? (winningTrades.length / totalTrades) * 100

        : 0;

    const averageProfit = winningTrades.length

        ? grossProfit / winningTrades.length

        : 0;

    const averageLoss = losingTrades.length

        ? grossLoss / losingTrades.length

        : 0;

    const profitFactor = grossLoss > 0

        ? grossProfit / grossLoss

        : grossProfit > 0
            ? Infinity
            : 0;

    const averageTrade = totalTrades > 0

        ? netProfit / totalTrades

        : 0;

    return {

        initialCapital,

        finalCapital,

        netProfit,

        returnPercentage,

        totalTrades,

        winningTrades: winningTrades.length,

        losingTrades: losingTrades.length,

        winRate,

        grossProfit,

        grossLoss,

        totalFees,

        profitFactor,

        averageProfit,

        averageLoss,

        averageTrade,

        maxDrawdown,

        equityCurve

    };

}


/* =====================================================
   MAIN BACKTEST ENGINE
===================================================== */

export function runBacktest(
    candles,
    options = {}
) {

    validateBacktestData(candles);

    const initialCapital =
        Number.isFinite(options.initialCapital) &&
        options.initialCapital > 0
            ? options.initialCapital
            : BACKTEST_SETTINGS.INITIAL_CAPITAL;

    let capital = initialCapital;

    let peakCapital = initialCapital;

    let maxDrawdown = 0;

    let activeTrade = null;

    const trades = [];

    const equityCurve = [];

    const indicators = calculateIndicators(candles);

    /*
       Start after sufficient indicator history.
       Signals use the completed candle at index i.
       Trades enter at the next candle's open to avoid
       look-ahead execution at the signal candle's close.
    */

    for (
        let i = 50;
        i < candles.length - 1;
        i++
    ) {

        const candle = candles[i];

        /*
           Check existing position first.
        */

        if (activeTrade) {

            const exit = checkExit(
                activeTrade,
                candle
            );

            if (exit) {

                const completedTrade = closeTrade(
                    activeTrade,
                    exit.price,
                    i,
                    exit.reason
                );

                validateTradeResult(completedTrade);

                trades.push(completedTrade);

                capital = updateEquity(
                    capital,
                    completedTrade
                );

                activeTrade = null;

            }

        }

        /*
           Generate a new signal only when flat.
        */

        if (!activeTrade) {

            const signal = historicalSignal(
                indicators,
                i
            );

            if (signal !== "HOLD") {

                const nextCandle = candles[i + 1];

                const atr = indicators.atr[i];

                if (
                    Number.isFinite(atr) &&
                    atr > 0
                ) {

                    const entryCandle = {
                        ...nextCandle,
                        close: nextCandle.open
                    };

                    activeTrade = openTrade(
                        signal,
                        entryCandle,
                        atr,
                        capital,
                        i + 1
                    );

                }

            }

        }

        /*
           Update equity and drawdown.
           Open positions are marked to market.
        */

        const currentEquity = activeTrade

            ? capital + calculateUnrealizedProfit(
                activeTrade,
                candle.close
            )

            : capital;

        peakCapital = Math.max(
            peakCapital,
            currentEquity
        );

        const drawdown = calculateDrawdown(
            currentEquity,
            peakCapital
        );

        maxDrawdown = Math.max(
            maxDrawdown,
            drawdown
        );

        equityCurve.push({

            index: i,

            time: candle.time ?? i,

            equity: currentEquity,

            drawdown

        });

    }

    /*
       Close any remaining position at the final candle.
    */

    if (activeTrade) {

        const lastIndex = candles.length - 1;

        const finalTrade = forceCloseTrade(
            activeTrade,
            candles[lastIndex],
            lastIndex
        );

        validateTradeResult(finalTrade);

        trades.push(finalTrade);

        capital = updateEquity(
            capital,
            finalTrade
        );

    }

    /*
       Record final equity.
    */

    peakCapital = Math.max(
        peakCapital,
        capital
    );

    maxDrawdown = Math.max(
        maxDrawdown,
        calculateDrawdown(
            capital,
            peakCapital
        )
    );

    equityCurve.push({

        index: candles.length - 1,

        time: candles[candles.length - 1].time ??
            candles.length - 1,

        equity: capital,

        drawdown: calculateDrawdown(
            capital,
            peakCapital
        )

    });

    const statistics = calculateStatistics(
        initialCapital,
        capital,
        trades,
        equityCurve,
        maxDrawdown
    );

    return {

        success: true,

        settings: {
            ...BACKTEST_SETTINGS
        },

        statistics,

        trades,

        equityCurve,

        indicators,

        timestamp: Date.now()

    };

}


/* =====================================================
   BACKTEST SETTINGS
===================================================== */

export function getBacktestSettings() {

    return {
        ...BACKTEST_SETTINGS
    };

}


/* =====================================================
   RESET BACKTEST SETTINGS
===================================================== */

export function resetBacktestSettings() {

    return {
        ...BACKTEST_SETTINGS
    };

}


/* =====================================================
   EXPORT BACKTEST RESULTS
===================================================== */

export function exportBacktestResults(results) {

    if (
        !results ||
        !results.success ||
        !Array.isArray(results.trades)
    ) {

        throw new Error(
            "Invalid backtest results."
        );

    }

    return JSON.stringify(
        results,
        null,
        2
    );

}
