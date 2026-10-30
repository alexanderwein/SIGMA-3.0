
/*
=========================================================
 SIGMA 3.0 — TECHNICAL INDICATOR ENGINE
=========================================================

Indicators:
- EMA
- SMA
- RSI (Wilder)
- MACD
- ATR (Wilder)
- ADX / DI+ / DI-
- Bollinger Bands
- Stochastic RSI
- VWAP
- OBV

All calculations use historical candle data.

=========================================================
*/


/* =====================================================
   VALIDATION
===================================================== */

function validateArray(values) {

    if (!Array.isArray(values) || !values.length) {

        throw new Error("Invalid indicator input.");

    }

    if (!values.every(Number.isFinite)) {

        throw new Error("Indicator input contains invalid values.");

    }

}


/* =====================================================
   SIMPLE MOVING AVERAGE
===================================================== */

export function sma(values, period) {

    validateArray(values);

    if (period < 1 || period > values.length) {

        throw new Error("Invalid SMA period.");

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

    if (
        !Number.isInteger(period) ||
        period < 1 ||
        values.length < period
    ) {

        throw new Error("Invalid EMA period.");

    }

    const result = Array(values.length).fill(null);

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
   WILDER SMOOTHING
===================================================== */

function wilderAverage(values, period) {

    validateArray(values);

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

    for (let i = period; i < values.length; i++) {

        previous =
            (previous * (period - 1) + values[i]) /
            period;

        result[i] = previous;

    }

    return result;

}


/* =====================================================
   RELATIVE STRENGTH INDEX
===================================================== */

export function rsi(values, period = 14) {

    validateArray(values);

    if (
        !Number.isInteger(period) ||
        period < 1
    ) {

        throw new Error("Invalid RSI period.");

    }

    const result = Array(values.length).fill(null);

    if (values.length <= period) {

        return result;

    }

    const gains = [];

    const losses = [];

    for (let i = 1; i < values.length; i++) {

        const change = values[i] - values[i - 1];

        gains.push(Math.max(change, 0));

        losses.push(Math.max(-change, 0));

    }

    const avgGain = wilderAverage(gains, period);

    const avgLoss = wilderAverage(losses, period);

    for (let i = period; i < values.length; i++) {

        const gain = avgGain[i - 1];

        const loss = avgLoss[i - 1];

        if (loss === 0) {

            result[i] = gain === 0 ? 50 : 100;

        } else {

            const rs = gain / loss;

            result[i] = 100 - 100 / (1 + rs);

        }

    }

    return result;

}


/* =====================================================
   MOVING AVERAGE CONVERGENCE DIVERGENCE
===================================================== */

export function macd(

    values,

    fast = 12,

    slow = 26,

    signalPeriod = 9

) {

    validateArray(values);

    if (
        fast >= slow ||
        fast < 1 ||
        signalPeriod < 1
    ) {

        throw new Error("Invalid MACD parameters.");

    }

    const fastEMA = ema(values, fast);

    const slowEMA = ema(values, slow);

    const line = Array(values.length).fill(null);

    for (let i = slow - 1; i < values.length; i++) {

        line[i] = fastEMA[i] - slowEMA[i];

    }

    const firstValid = slow - 1;

    const compact = line.slice(firstValid);

    const signalCompact = ema(compact, signalPeriod);

    const signal = Array(values.length).fill(null);

    const histogram = Array(values.length).fill(null);

    for (let i = 0; i < signalCompact.length; i++) {

        const index = firstValid + i;

        signal[index] = signalCompact[i];

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
   TRUE RANGE
===================================================== */

export function trueRange(candles) {

    validateCandles(candles);

    return candles.map((candle, i) => {

        if (i === 0) {

            return candle.high - candle.low;

        }

        const previous = candles[i - 1];

        return Math.max(

            candle.high - candle.low,

            Math.abs(candle.high - previous.close),

            Math.abs(candle.low - previous.close)

        );

    });

}


/* =====================================================
   AVERAGE TRUE RANGE
===================================================== */

export function atr(candles, period = 14) {

    const ranges = trueRange(candles);

    return wilderAverage(ranges, period);

}


/* =====================================================
   AVERAGE DIRECTIONAL INDEX
===================================================== */

export function adx(candles, period = 14) {

    validateCandles(candles);

    const length = candles.length;

    const plusDM = Array(length).fill(0);

    const minusDM = Array(length).fill(0);

    const ranges = trueRange(candles);

    for (let i = 1; i < length; i++) {

        const up =
            candles[i].high - candles[i - 1].high;

        const down =
            candles[i - 1].low - candles[i].low;

        if (up > down && up > 0) {

            plusDM[i] = up;

        }

        if (down > up && down > 0) {

            minusDM[i] = down;

        }

    }

    const smoothedTR = wilderAverage(ranges, period);

    const smoothedPlus = wilderAverage(plusDM, period);

    const smoothedMinus = wilderAverage(minusDM, period);

    const plusDI = Array(length).fill(null);

    const minusDI = Array(length).fill(null);

    const dx = Array(length).fill(null);

    for (let i = period - 1; i < length; i++) {

        const tr = smoothedTR[i];

        if (tr === 0 || tr === null) {

            continue;

        }

        plusDI[i] =
            100 * smoothedPlus[i] / tr;

        minusDI[i] =
            100 * smoothedMinus[i] / tr;

        const total = plusDI[i] + minusDI[i];

        dx[i] = total === 0

            ? 0

            : 100 * Math.abs(
                plusDI[i] - minusDI[i]
            ) / total;

    }

    const validDX = dx.slice(period - 1);

    const validADX = wilderAverage(validDX, period);

    const adxValues = Array(length).fill(null);

    for (let i = 0; i < validADX.length; i++) {

        adxValues[period - 1 + i] = validADX[i];

    }

    return {

        adx: adxValues,

        plusDI,

        minusDI

    };

}


/* =====================================================
   BOLLINGER BANDS
===================================================== */

export function bollinger(

    values,

    period = 20,

    multiplier = 2

) {

    validateArray(values);

    const middle = sma(values, period);

    const upper = Array(values.length).fill(null);

    const lower = Array(values.length).fill(null);

    const deviation = Array(values.length).fill(null);

    for (let i = period - 1; i < values.length; i++) {

        const mean = middle[i];

        let variance = 0;

        for (
            let j = i - period + 1;
            j <= i;
            j++
        ) {

            variance += Math.pow(
                values[j] - mean,
                2
            );

        }

        const sd = Math.sqrt(variance / period);

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

    rsiPeriod = 14,

    stochasticPeriod = 14,

    kPeriod = 3,

    dPeriod = 3

) {

    const rsiValues = rsi(values, rsiPeriod);

    const raw = Array(values.length).fill(null);

    for (
        let i = rsiPeriod + stochasticPeriod - 1;
        i < values.length;
        i++
    ) {

        const window = rsiValues.slice(

            i - stochasticPeriod + 1,

            i + 1

        );

        if (window.some(value => value === null)) {

            continue;

        }

        const min = Math.min(...window);

        const max = Math.max(...window);

        raw[i] = max === min

            ? 50

            : 100 * (rsiValues[i] - min) / (max - min);

    }

    const validStart = raw.findIndex(
        value => value !== null
    );

    if (validStart === -1) {

        return {

            k: Array(values.length).fill(null),

            d: Array(values.length).fill(null)

        };

    }

    const compact = raw.slice(validStart);

    const compactValues = compact.map(
        value => value === null ? 0 : value
    );

    const compactK = sma(compactValues, kPeriod);

    const compactD = sma(

        compactK.map(
            value => value === null ? 0 : value
        ),

        dPeriod

    );

    const k = Array(values.length).fill(null);

    const d = Array(values.length).fill(null);

    for (let i = 0; i < compact.length; i++) {

        const index = validStart + i;

        if (i >= kPeriod - 1 && compact[i] !== null) {

            k[index] = compactK[i];

        }

        if (
            i >= kPeriod + dPeriod - 2 &&
            k[index] !== null
        ) {

            d[index] = compactD[i];

        }

    }

    return { k, d };

}


/* =====================================================
   VOLUME WEIGHTED AVERAGE PRICE
===================================================== */

/*
Session VWAP is reset each UTC day.
*/

export function vwap(candles) {

    validateCandles(candles);

    const result = Array(candles.length).fill(null);

    let cumulativePriceVolume = 0;

    let cumulativeVolume = 0;

    let currentSession = null;

    for (let i = 0; i < candles.length; i++) {

        const candle = candles[i];

        const session = new Date(
            candle.time * 1000
        ).toISOString().slice(0, 10);

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
                cumulativePriceVolume / cumulativeVolume;

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

    for (let i = 1; i < candles.length; i++) {

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
   CANDLE VALIDATION
===================================================== */

export function validateCandles(candles) {

    if (!Array.isArray(candles) || !candles.length) {

        throw new Error("Invalid candle data.");

    }

    for (const candle of candles) {

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

    }

    return true;

}


/* =====================================================
   COMPLETE TECHNICAL ANALYSIS
===================================================== */

export function calculateAll(candles) {

    validateCandles(candles);

    const close = candles.map(
        candle => candle.close
    );

    const macdResult = macd(close);

    const adxResult = adx(candles);

    const bands = bollinger(close);

    const stoch = stochasticRSI(close);

    return {

        ema9: ema(close, 9),

        ema20: ema(close, 20),

        ema50: ema(close, 50),

        rsi: rsi(close, 14),

        macd: macdResult.line,

        macdSignal: macdResult.signal,

        macdHistogram: macdResult.histogram,

        atr: atr(candles, 14),

        adx: adxResult.adx,

        plusDI: adxResult.plusDI,

        minusDI: adxResult.minusDI,

        bollingerUpper: bands.upper,

        bollingerMiddle: bands.middle,

        bollingerLower: bands.lower,

        stochasticK: stoch.k,

        stochasticD: stoch.d,

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

    for (const [name, values] of Object.entries(analysis)) {

        snapshot[name] = values[last];

    }

    return snapshot;

}
