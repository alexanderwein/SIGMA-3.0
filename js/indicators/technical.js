
/*
=========================================================
 SIGMA 3.0 — TECHNICAL INDICATOR ENGINE
 PART 1: VALIDATION AND CORE INDICATORS
=========================================================
*/

const INDICATOR_SETTINGS = {
    RSI_PERIOD: 14,
    ATR_PERIOD: 14,
    ADX_PERIOD: 14,
    MACD_FAST: 12,
    MACD_SLOW: 26,
    MACD_SIGNAL: 9,
    BOLLINGER_PERIOD: 20,
    STOCHASTIC_PERIOD: 14
};


/* =====================================================
   ARRAY VALIDATION
===================================================== */

function validateArray(values) {

    if (
        !Array.isArray(values) ||
        values.length === 0
    ) {
        throw new Error("Invalid indicator input.");
    }

    if (!values.every(Number.isFinite)) {

        throw new Error(
            "Indicator input contains invalid values."
        );

    }

    return true;
}


/* =====================================================
   PERIOD VALIDATION
===================================================== */

function validatePeriod(period, name = "period") {

    if (
        !Number.isInteger(period) ||
        period < 1
    ) {

        throw new Error(
            `Invalid ${name}.`
        );

    }

    return true;
}


/* =====================================================
   CANDLE VALIDATION
===================================================== */

export function validateCandles(candles) {

    if (
        !Array.isArray(candles) ||
        candles.length === 0
    ) {

        throw new Error(
            "Invalid candle data."
        );

    }

    let previousTime = -Infinity;

    for (const candle of candles) {

        if (
            !candle ||
            typeof candle !== "object"
        ) {

            throw new Error(
                "Invalid candle object."
            );

        }

        const values = [
            candle.time,
            candle.open,
            candle.high,
            candle.low,
            candle.close,
            candle.volume
        ];

        if (!values.every(Number.isFinite)) {

            throw new Error(
                "Invalid OHLCV candle values."
            );

        }

        if (
            candle.time <= previousTime ||
            candle.time <= 0 ||
            candle.low <= 0 ||
            candle.high < candle.low ||
            candle.open < candle.low ||
            candle.open > candle.high ||
            candle.close < candle.low ||
            candle.close > candle.high ||
            candle.volume < 0
        ) {

            throw new Error(
                "Inconsistent OHLCV candle."
            );

        }

        previousTime = candle.time;

    }

    return true;
}


/* =====================================================
   SIMPLE MOVING AVERAGE
===================================================== */

export function sma(values, period) {

    validateArray(values);
    validatePeriod(period);

    if (period > values.length) {

        throw new Error(
            "Insufficient data for SMA calculation."
        );

    }

    const result = Array(values.length).fill(null);

    let sum = 0;

    for (let i = 0; i < values.length; i++) {

        sum += values[i];

        if (i >= period) {

            sum -= values[i - period];

        }

        if (i >= period - 1) {

            result[i] = sum / period;

        }

    }

    return result;
}


/* =====================================================
   EXPONENTIAL MOVING AVERAGE
===================================================== */

export function ema(values, period) {

    validateArray(values);
    validatePeriod(period);

    if (period > values.length) {

        throw new Error(
            "Insufficient data for EMA calculation."
        );

    }

    const result = Array(values.length).fill(null);

    const multiplier = 2 / (period + 1);

    let initial = 0;

    for (let i = 0; i < period; i++) {

        initial += values[i];

    }

    let previous = initial / period;

    result[period - 1] = previous;

    for (
        let i = period;
        i < values.length;
        i++
    ) {

        previous =
            values[i] * multiplier +
            previous * (1 - multiplier);

        result[i] = previous;

    }

    return result;
}


/* =====================================================
   WILDER SMOOTHING
===================================================== */

function wilderAverage(values, period) {

    validateArray(values);
    validatePeriod(period);

    const result = Array(values.length).fill(null);

    if (values.length < period) {

        return result;

    }

    let initial = 0;

    for (let i = 0; i < period; i++) {

        initial += values[i];

    }

    let previous = initial / period;

    result[period - 1] = previous;

    for (
        let i = period;
        i < values.length;
        i++
    ) {

        previous = (

            previous * (period - 1) +
            values[i]

        ) / period;

        result[i] = previous;

    }

    return result;
}


/* =====================================================
   RELATIVE STRENGTH INDEX — WILDER
===================================================== */

export function rsi(
    values,
    period = INDICATOR_SETTINGS.RSI_PERIOD
) {

    validateArray(values);
    validatePeriod(period, "RSI period");

    const result = Array(values.length).fill(null);

    if (values.length <= period) {

        return result;

    }

    const gains = [];
    const losses = [];

    for (let i = 1; i < values.length; i++) {

        const change =
            values[i] - values[i - 1];

        gains.push(
            Math.max(change, 0)
        );

        losses.push(
            Math.max(-change, 0)
        );

    }

    const averageGain = wilderAverage(
        gains,
        period
    );

    const averageLoss = wilderAverage(
        losses,
        period
    );

    for (
        let i = period;
        i < values.length;
        i++
    ) {

        const gain = averageGain[i - 1];
        const loss = averageLoss[i - 1];

        if (
            gain === null ||
            loss === null
        ) {

            continue;

        }

        if (loss === 0) {

            result[i] = gain === 0 ? 50 : 100;

        } else {

            const relativeStrength = gain / loss;

            result[i] =
                100 - (100 / (1 + relativeStrength));

        }

    }

    return result;
}

/* =====================================================
   MOVING AVERAGE CONVERGENCE DIVERGENCE — MACD
===================================================== */

export function macd(
    values,
    fast = INDICATOR_SETTINGS.MACD_FAST,
    slow = INDICATOR_SETTINGS.MACD_SLOW,
    signalPeriod = INDICATOR_SETTINGS.MACD_SIGNAL
) {

    validateArray(values);

    validatePeriod(fast, "MACD fast period");
    validatePeriod(slow, "MACD slow period");
    validatePeriod(signalPeriod, "MACD signal period");

    if (fast >= slow) {

        throw new Error(
            "MACD fast period must be smaller than slow period."
        );

    }

    const line = Array(values.length).fill(null);
    const signal = Array(values.length).fill(null);
    const histogram = Array(values.length).fill(null);

    if (values.length < slow + signalPeriod - 1) {

        return {
            line,
            signal,
            histogram
        };

    }

    const fastEMA = ema(values, fast);
    const slowEMA = ema(values, slow);

    const firstValid = slow - 1;

    for (
        let i = firstValid;
        i < values.length;
        i++
    ) {

        line[i] = fastEMA[i] - slowEMA[i];

    }

    const compactLine = line.slice(firstValid);

    const compactSignal = ema(
        compactLine,
        signalPeriod
    );

    for (
        let i = 0;
        i < compactSignal.length;
        i++
    ) {

        if (compactSignal[i] === null) {
            continue;
        }

        const index = firstValid + i;

        signal[index] = compactSignal[i];

        histogram[index] =
            line[index] - signal[index];

    }

    return {
        line,
        signal,
        histogram
    };

}


/* =====================================================
   TRUE RANGE
===================================================== */

export function trueRange(candles) {

    validateCandles(candles);

    return candles.map((candle, index) => {

        if (index === 0) {

            return candle.high - candle.low;

        }

        const previous = candles[index - 1];

        return Math.max(

            candle.high - candle.low,

            Math.abs(
                candle.high - previous.close
            ),

            Math.abs(
                candle.low - previous.close
            )

        );

    });

}


/* =====================================================
   AVERAGE TRUE RANGE — WILDER
===================================================== */

export function atr(
    candles,
    period = INDICATOR_SETTINGS.ATR_PERIOD
) {

    validateCandles(candles);

    validatePeriod(period, "ATR period");

    const ranges = trueRange(candles);

    return wilderAverage(
        ranges,
        period
    );

}


/* =====================================================
   AVERAGE DIRECTIONAL INDEX — ADX
===================================================== */

export function adx(
    candles,
    period = INDICATOR_SETTINGS.ADX_PERIOD
) {

    validateCandles(candles);

    validatePeriod(period, "ADX period");

    const length = candles.length;

    const result = {

        adx: Array(length).fill(null),

        plusDI: Array(length).fill(null),

        minusDI: Array(length).fill(null)

    };

    if (length < period * 2) {

        return result;

    }

    const plusDM = Array(length).fill(0);

    const minusDM = Array(length).fill(0);

    for (let i = 1; i < length; i++) {

        const current = candles[i];

        const previous = candles[i - 1];

        const upwardMove =
            current.high - previous.high;

        const downwardMove =
            previous.low - current.low;

        if (
            upwardMove > downwardMove &&
            upwardMove > 0
        ) {

            plusDM[i] = upwardMove;

        }

        if (
            downwardMove > upwardMove &&
            downwardMove > 0
        ) {

            minusDM[i] = downwardMove;

        }

    }

    const ranges = trueRange(candles);

    const smoothedTR = wilderAverage(
        ranges,
        period
    );

    const smoothedPlusDM = wilderAverage(
        plusDM,
        period
    );

    const smoothedMinusDM = wilderAverage(
        minusDM,
        period
    );

    const dx = Array(length).fill(null);

    for (
        let i = period - 1;
        i < length;
        i++
    ) {

        const tr = smoothedTR[i];

        if (
            tr === null ||
            tr <= 0
        ) {

            continue;

        }

        const plusDI =
            100 * smoothedPlusDM[i] / tr;

        const minusDI =
            100 * smoothedMinusDM[i] / tr;

        result.plusDI[i] = plusDI;

        result.minusDI[i] = minusDI;

        const totalDI = plusDI + minusDI;

        dx[i] = totalDI === 0

            ? 0

            : 100 * Math.abs(
                plusDI - minusDI
            ) / totalDI;

    }

    /*
       Initialize ADX using the first complete
       period of valid DX values.
    */

    const firstADXIndex = period * 2 - 2;

    let initialSum = 0;

    let validCount = 0;

    for (
        let i = period - 1;
        i <= firstADXIndex;
        i++
    ) {

        if (dx[i] !== null) {

            initialSum += dx[i];

            validCount++;

        }

    }

    if (validCount !== period) {

        return result;

    }

    let previousADX = initialSum / period;

    result.adx[firstADXIndex] = previousADX;

    /*
       Wilder recursive smoothing.
    */

    for (
        let i = firstADXIndex + 1;
        i < length;
        i++
    ) {

        if (dx[i] === null) {

            continue;

        }

        previousADX = (

            previousADX * (period - 1) +
            dx[i]

        ) / period;

        result.adx[i] = previousADX;

    }

    return result;

}


/* =====================================================
   BOLLINGER BANDS
===================================================== */

export function bollinger(
    values,
    period = INDICATOR_SETTINGS.BOLLINGER_PERIOD,
    multiplier = 2
) {

    validateArray(values);

    validatePeriod(period, "Bollinger period");

    if (
        !Number.isFinite(multiplier) ||
        multiplier < 0
    ) {

        throw new Error(
            "Invalid Bollinger multiplier."
        );

    }

    const middle = Array(values.length).fill(null);

    const upper = Array(values.length).fill(null);

    const lower = Array(values.length).fill(null);

    const deviation = Array(values.length).fill(null);

    if (values.length < period) {

        return {
            middle,
            upper,
            lower,
            deviation
        };

    }

    let sum = 0;

    let squaredSum = 0;

    for (let i = 0; i < values.length; i++) {

        const value = values[i];

        sum += value;

        squaredSum += value * value;

        if (i >= period) {

            const removed = values[i - period];

            sum -= removed;

            squaredSum -= removed * removed;

        }

        if (i < period - 1) {

            continue;

        }

        const mean = sum / period;

        const variance = Math.max(
            0,
            squaredSum / period - mean * mean
        );

        const sd = Math.sqrt(variance);

        middle[i] = mean;

        deviation[i] = sd;

        upper[i] = mean + multiplier * sd;

        lower[i] = mean - multiplier * sd;

    }

    return {
        middle,
        upper,
        lower,
        deviation
    };

}


/* =====================================================
   STOCHASTIC RSI
===================================================== */

export function stochasticRSI(
    values,
    rsiPeriod = INDICATOR_SETTINGS.RSI_PERIOD,
    stochasticPeriod = INDICATOR_SETTINGS.STOCHASTIC_PERIOD,
    kPeriod = 3,
    dPeriod = 3
) {

    validateArray(values);

    validatePeriod(rsiPeriod, "RSI period");

    validatePeriod(
        stochasticPeriod,
        "Stochastic period"
    );

    validatePeriod(kPeriod, "K period");

    validatePeriod(dPeriod, "D period");

    const rsiValues = rsi(
        values,
        rsiPeriod
    );

    const raw = Array(values.length).fill(null);

    const k = Array(values.length).fill(null);

    const d = Array(values.length).fill(null);

    for (
        let i = 0;
        i < values.length;
        i++
    ) {

        if (i < rsiPeriod + stochasticPeriod - 1) {

            continue;

        }

        const window = rsiValues.slice(
            i - stochasticPeriod + 1,
            i + 1
        );

        if (
            window.some(
                value => value === null
            )
        ) {

            continue;

        }

        const minimum = Math.min(...window);

        const maximum = Math.max(...window);

        raw[i] = maximum === minimum

            ? 50

            : 100 * (
                (rsiValues[i] - minimum) /
                (maximum - minimum)
            );

    }

    /*
       Smooth raw Stochastic RSI into %K.
    */

    for (
        let i = 0;
        i < values.length;
        i++
    ) {

        if (i < rsiPeriod + stochasticPeriod + kPeriod - 2) {

            continue;

        }

        let sum = 0;

        let valid = true;

        for (
            let j = i - kPeriod + 1;
            j <= i;
            j++
        ) {

            if (raw[j] === null) {

                valid = false;

                break;

            }

            sum += raw[j];

        }

        if (valid) {

            k[i] = sum / kPeriod;

        }

    }

    /*
       Smooth %K into %D.
    */

    for (
        let i = 0;
        i < values.length;
        i++
    ) {

        if (i < rsiPeriod + stochasticPeriod + kPeriod + dPeriod - 3) {

            continue;

        }

        let sum = 0;

        let valid = true;

        for (
            let j = i - dPeriod + 1;
            j <= i;
            j++
        ) {

            if (k[j] === null) {

                valid = false;

                break;

            }

            sum += k[j];

        }

        if (valid) {

            d[i] = sum / dPeriod;

        }

    }

    return {
        k,
        d
    };

}


/* =====================================================
   VOLUME WEIGHTED AVERAGE PRICE
===================================================== */

/*
   Session VWAP resets at UTC midnight.
*/

export function vwap(candles) {

    validateCandles(candles);

    const result = Array(candles.length).fill(null);

    let cumulativePriceVolume = 0;

    let cumulativeVolume = 0;

    let currentSession = null;

    for (
        let i = 0;
        i < candles.length;
        i++
    ) {

        const candle = candles[i];

        const session = new Date(
            candle.time * 1000
        ).toISOString().slice(0, 10);

        /*
           Reset VWAP at the start of a new UTC day.
        */

        if (session !== currentSession) {

            cumulativePriceVolume = 0;

            cumulativeVolume = 0;

            currentSession = session;

        }

        const typicalPrice = (

            candle.high +
            candle.low +
            candle.close

        ) / 3;

        cumulativePriceVolume +=
            typicalPrice * candle.volume;

        cumulativeVolume += candle.volume;

        if (cumulativeVolume > 0) {

            result[i] =
                cumulativePriceVolume /
                cumulativeVolume;

        }

    }

    return result;

}


/* =====================================================
   ON BALANCE VOLUME
===================================================== */

export function obv(candles) {

    validateCandles(candles);

    const result = Array(candles.length).fill(0);

    for (
        let i = 1;
        i < candles.length;
        i++
    ) {

        const current = candles[i];

        const previous = candles[i - 1];

        if (current.close > previous.close) {

            result[i] =
                result[i - 1] + current.volume;

        } else if (current.close < previous.close) {

            result[i] =
                result[i - 1] - current.volume;

        } else {

            result[i] = result[i - 1];

        }

    }

    return result;

}


/* =====================================================
   COMPLETE TECHNICAL ANALYSIS
===================================================== */

export function calculateAll(candles) {

    validateCandles(candles);

    const close = candles.map(
        candle => candle.close
    );

    /*
       MACD
    */

    const macdResult = macd(
        close,
        INDICATOR_SETTINGS.MACD_FAST,
        INDICATOR_SETTINGS.MACD_SLOW,
        INDICATOR_SETTINGS.MACD_SIGNAL
    );

    /*
       ADX
    */

    const adxResult = adx(
        candles,
        INDICATOR_SETTINGS.ADX_PERIOD
    );

    /*
       Bollinger Bands
    */

    const bands = bollinger(
        close,
        INDICATOR_SETTINGS.BOLLINGER_PERIOD,
        2
    );

    /*
       Stochastic RSI
    */

    const stochastic = stochasticRSI(
        close,
        INDICATOR_SETTINGS.RSI_PERIOD,
        INDICATOR_SETTINGS.STOCHASTIC_PERIOD,
        3,
        3
    );

    /*
       Return all indicator arrays.
    */

    return {

        ema9: ema(close, 9),

        ema20: ema(close, 20),

        ema50: ema(close, 50),

        rsi: rsi(
            close,
            INDICATOR_SETTINGS.RSI_PERIOD
        ),

        macd: macdResult.line,

        macdSignal: macdResult.signal,

        macdHistogram: macdResult.histogram,

        atr: atr(
            candles,
            INDICATOR_SETTINGS.ATR_PERIOD
        ),

        adx: adxResult.adx,

        plusDI: adxResult.plusDI,

        minusDI: adxResult.minusDI,

        bollingerUpper: bands.upper,

        bollingerMiddle: bands.middle,

        bollingerLower: bands.lower,

        stochasticK: stochastic.k,

        stochasticD: stochastic.d,

        vwap: vwap(candles),

        obv: obv(candles)

    };

}


/* =====================================================
   LATEST INDICATOR SNAPSHOT
===================================================== */

export function getLatestIndicators(candles) {

    const analysis = calculateAll(candles);

    const last = candles.length - 1;

    const snapshot = {};

    for (
        const [name, values]
        of Object.entries(analysis)
    ) {

        snapshot[name] = values[last];

    }

    return snapshot;

}
