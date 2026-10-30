
/*
=========================================================
 SIGMA 3.0 — MAIN APPLICATION
 PART 1: IMPORTS AND CONFIGURATION
=========================================================
*/

import {
    updateCharts,
    updateForecastChart,
    setChartType,
    resetCharts
} from "./charts/charts.js";

import {
    generateSignal,
    saveSignal,
    getSignalHistory
} from "./signals/signalEngine.js";

import {
    generateForecast,
    getForecastSummary
} from "./forecast/forecastEngine.js";

import {
    runBacktest,
    exportTradeHistory
} from "./backtest/backtestEngine.js";


/* =====================================================
   APPLICATION CONFIGURATION
===================================================== */

const CONFIG = {

    API: "https://api.binance.com/api/v3",

    DEFAULT_SYMBOL: "BTCUSDT",

    DEFAULT_INTERVAL: "1d",

    CANDLE_LIMIT: 500,

    REFRESH_INTERVAL: 60000,

    MAX_RETRIES: 3,

    FORECAST_HORIZON: 7

};


/* =====================================================
   APPLICATION STATE
===================================================== */

const state = {

    symbol: CONFIG.DEFAULT_SYMBOL,

    interval: CONFIG.DEFAULT_INTERVAL,

    candles: [],

    indicators: null,

    signal: null,

    forecast: null,

    backtest: null,

    marketData: [],

    loading: false,

    lastUpdate: null,

    error: null

};


/* =====================================================
   DOM HELPER
===================================================== */

const $ = id => document.getElementById(id);


/* =====================================================
   NUMBER FORMATTING
===================================================== */

function formatNumber(value, decimals = 2) {

    if (!Number.isFinite(Number(value))) {

        return "—";

    }

    return Number(value).toLocaleString(
        "en-US",
        {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }
    );

}


function formatPrice(value) {

    if (!Number.isFinite(Number(value))) {

        return "—";

    }

    return "$" + formatNumber(value, 4);

}


/* =====================================================
   APPLICATION STATUS
===================================================== */

function setStatus(message, type = "normal") {

    const element = $("status");

    if (!element) return;

    element.textContent = message;

    element.dataset.type = type;

}


/* =====================================================
   APPLICATION ERROR HANDLING
===================================================== */

function handleError(error) {

    console.error("SIGMA application error:", error);

    state.error = error.message;

    setStatus(
        "ERROR: " + error.message,
        "error"
    );

}


/* =====================================================
   API REQUEST
===================================================== */

async function fetchJSON(url) {

    let lastError;

    for (
        let attempt = 1;
        attempt <= CONFIG.MAX_RETRIES;
        attempt++
    ) {

        try {

            const response = await fetch(url);

            if (!response.ok) {

                throw new Error(
                    "API request failed: " + response.status
                );

            }

            return await response.json();

        } catch (error) {

            lastError = error;

            if (attempt < CONFIG.MAX_RETRIES) {

                await new Promise(resolve =>
                    setTimeout(resolve, attempt * 1000)
                );

            }

        }

    }

    throw lastError;

}

/* =====================================================
   LOAD BINANCE MARKETS
===================================================== */

async function loadMarkets() {

    setStatus("LOADING MARKETS...");

    const data = await fetchJSON(
        CONFIG.API + "/ticker/24hr"
    );

    state.marketData = data

        .filter(item =>
            item.symbol.endsWith("USDT") &&
            !/(UP|DOWN|BULL|BEAR)USDT$/.test(item.symbol)
        )

        .sort((a, b) =>
            Number(b.quoteVolume) -
            Number(a.quoteVolume)
        )

        .slice(0, 50);

    renderMarketList();

    populateAssetSelector();

}


/* =====================================================
   POPULATE ASSET SELECTOR
===================================================== */

function populateAssetSelector() {

    const selector = $("asset");

    if (!selector) return;

    selector.innerHTML = state.marketData.map(item => {

        return `
            <option value="${item.symbol}">
                ${item.symbol.replace("USDT", "")} / USDT
            </option>
        `;

    }).join("");

    selector.value = state.symbol;

}


/* =====================================================
   RENDER MARKET TABLE
===================================================== */

function renderMarketList() {

    const container = $("markets");

    if (!container) return;

    container.innerHTML = state.marketData.map(item => {

        const change = Number(item.priceChangePercent);

        return `
            <tr data-symbol="${item.symbol}">

                <td>${item.symbol.replace("USDT", "")}</td>

                <td>${formatPrice(Number(item.lastPrice))}</td>

                <td class="${change >= 0 ? "positive" : "negative"}">
                    ${formatNumber(change)}%
                </td>

                <td>
                    ${formatNumber(
                        Number(item.quoteVolume) / 1000000
                    )}M
                </td>

            </tr>
        `;

    }).join("");

    container.querySelectorAll("tr[data-symbol]")
        .forEach(row => {

            row.addEventListener("click", () => {

                selectAsset(row.dataset.symbol);

            });

        });

}


/* =====================================================
   LOAD HISTORICAL CANDLES
===================================================== */

async function loadCandles() {

    setStatus("LOADING " + state.symbol + "...");

    const url =
        CONFIG.API +
        "/klines?symbol=" + encodeURIComponent(state.symbol) +
        "&interval=" + encodeURIComponent(state.interval) +
        "&limit=" + CONFIG.CANDLE_LIMIT;

    const raw = await fetchJSON(url);

    state.candles = raw.map(item => ({

        time: Math.floor(Number(item[0]) / 1000),

        open: Number(item[1]),

        high: Number(item[2]),

        low: Number(item[3]),

        close: Number(item[4]),

        volume: Number(item[5])

    }));

    if (state.candles.length < 60) {

        throw new Error("Insufficient historical data.");

    }

}


/* =====================================================
   CALCULATE EMA
===================================================== */

function calculateEMA(values, period) {

    const multiplier = 2 / (period + 1);

    let previous = values[0];

    return values.map((value, index) => {

        if (index === 0) return previous;

        previous =
            value * multiplier +
            previous * (1 - multiplier);

        return previous;

    });

}


/* =====================================================
   CALCULATE RSI
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
   CALCULATE MACD
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
   CALCULATE ATR
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
   CALCULATE ALL INDICATORS
===================================================== */

function calculateAllIndicators() {

    const prices = state.candles.map(
        candle => candle.close
    );

    const ema9 = calculateEMA(prices, 9);

    const ema20 = calculateEMA(prices, 20);

    const ema50 = calculateEMA(prices, 50);

    const rsi = calculateRSI(prices);

    const macd = calculateMACD(prices);

    const atr = calculateATR(state.candles);

    const last = prices.length - 1;

    // Calculate average volume.

    const volumes = state.candles.map(
        candle => candle.volume
    );

    const recentVolumes = volumes.slice(-20);

    const averageVolume =
        recentVolumes.reduce(
            (sum, value) => sum + value,
            0
        ) / recentVolumes.length;

    state.indicators = {

        symbol: state.symbol,

        price: prices[last],

        ema9: ema9[last],

        ema20: ema20[last],

        ema50: ema50[last],

        rsi: rsi[last],

        macd: macd.line[last],

        macdSignal: macd.signal[last],

        macdHistogram: macd.histogram[last],

        atr: atr[last],

        volume: volumes[last],

        averageVolume,

        // Complete historical indicator arrays.

        ema9History: ema9,

        ema20History: ema20,

        ema50History: ema50,

        rsiHistory: rsi,

        macdHistory: macd.line,

        macdSignalHistory: macd.signal,

        macdHistogramHistory: macd.histogram,

        atrHistory: atr

    };

}

/* =====================================================
   GENERATE TRADING SIGNAL
===================================================== */

function updateTradingSignal() {

    const data = state.indicators;

    if (!data) return;

    try {

        const result = generateSignal(data);

        state.signal = result;

        saveSignal(result);

        renderTradingSignal(result);

    } catch (error) {

        console.error("Signal generation failed:", error);

    }

}


/* =====================================================
   RENDER TRADING SIGNAL
===================================================== */

function renderTradingSignal(result) {

    const signalElement = $("signal");

    if (!signalElement) return;

    signalElement.textContent = result.signal;

    signalElement.className =
        "signal-value " + result.signal.toLowerCase();

    const confidence = $("confidence");

    if (confidence) {

        confidence.textContent =
            result.confidence + "/100";

    }

    const buyScore = $("buyScore");

    if (buyScore) {

        buyScore.textContent =
            result.scores.buy;

    }

    const sellScore = $("sellScore");

    if (sellScore) {

        sellScore.textContent =
            result.scores.sell;

    }

    const explanation = $("signalExplanation");

    if (explanation) {

        explanation.textContent =
            result.explanation;

    }

    if (result.risk) {

        setText("entryPrice", formatPrice(result.risk.entry));

        setText("stopLoss", formatPrice(result.risk.stopLoss));

        setText("takeProfit", formatPrice(result.risk.takeProfit));

    } else {

        setText("entryPrice", "—");

        setText("stopLoss", "—");

        setText("takeProfit", "—");

    }

}


/* =====================================================
   GENERATE PRICE FORECAST
===================================================== */

function updateForecast() {

    try {

        state.forecast = generateForecast(

            state.candles,

            {

                symbol: state.symbol,

                rsi: state.indicators.rsi,

                macd: state.indicators.macd,

                macdSignal: state.indicators.macdSignal

            },

            CONFIG.FORECAST_HORIZON

        );

        renderForecast(state.forecast);

    } catch (error) {

        console.error("Forecast failed:", error);

    }

}


/* =====================================================
   RENDER FORECAST
===================================================== */

function renderForecast(forecast) {

    if (!forecast) return;

    setText(
        "forecastDirection",
        forecast.direction
    );

    setText(
        "forecastPrice",
        formatPrice(forecast.expectedPrice)
    );

    setText(
        "forecastLower",
        formatPrice(forecast.lowerRange)
    );

    setText(
        "forecastUpper",
        formatPrice(forecast.upperRange)
    );

    setText(
        "bullishScenario",
        formatPrice(forecast.bullishScenario)
    );

    setText(
        "neutralScenario",
        formatPrice(forecast.neutralScenario)
    );

    setText(
        "bearishScenario",
        formatPrice(forecast.bearishScenario)
    );

    // Update forecast overlay on price chart.

    const forecastPoints = forecast.points.map(point => ({

        time: point.time,

        value: point.expected

    }));

    updateForecastChart(forecastPoints);

}


/* =====================================================
   RENDER TECHNICAL INDICATORS
===================================================== */

function renderIndicators() {

    const data = state.indicators;

    if (!data) return;

    setText("ema9", formatPrice(data.ema9));

    setText("ema20", formatPrice(data.ema20));

    setText("ema50", formatPrice(data.ema50));

    setText("rsi", formatNumber(data.rsi));

    setText("macd", formatNumber(data.macd, 6));

    setText("atr", formatPrice(data.atr));

    setText(
        "volumeRatio",
        formatNumber(
            data.volume / data.averageVolume
        ) + "x"
    );

}


/* =====================================================
   UPDATE CHARTS
===================================================== */

function refreshCharts() {

    if (!state.candles.length || !state.indicators) {

        return;

    }

    const indicators = {

        ema20: state.indicators.ema20History,

        ema50: state.indicators.ema50History,

        rsi: state.indicators.rsiHistory,

        macd: state.indicators.macdHistory,

        macdSignal: state.indicators.macdSignalHistory,

        macdHistogram: state.indicators.macdHistogramHistory

    };

    updateCharts(

        state.candles,

        indicators

    );

}


/* =====================================================
   HELPER: UPDATE TEXT ELEMENTS
===================================================== */

function setText(id, value) {

    const element = $(id);

    if (element) {

        element.textContent = value;

    }

}


/* =====================================================
   UPDATE MARKET SUMMARY
===================================================== */

function renderMarketSummary() {

    const latest = state.candles.at(-1);

    if (!latest) return;

    const previous = state.candles.at(-2);

    const change =
        ((latest.close / previous.close) - 1) * 100;

    setText(
        "price",
        formatPrice(latest.close)
    );

    setText(
        "priceChange",
        (change >= 0 ? "+" : "") +
        formatNumber(change) + "%"
    );

    setText(
        "updated",
        new Date().toLocaleTimeString()
    );

}


/* =====================================================
   COMPLETE DASHBOARD UPDATE
===================================================== */

function updateDashboard() {

    renderMarketSummary();

    renderIndicators();

    refreshCharts();

    updateTradingSignal();

    updateForecast();

    setStatus(
        "● LIVE DATA CONNECTED",
        "success"
    );

}

/* =====================================================
   SELECT CRYPTO ASSET
===================================================== */

async function selectAsset(symbol) {

    if (!symbol || symbol === state.symbol) return;

    state.symbol = symbol;

    const selector = $("asset");

    if (selector) {
        selector.value = symbol;
    }

    await refreshApplication();

}


/* =====================================================
   CHANGE TIMEFRAME
===================================================== */

async function changeInterval(interval) {

    if (!interval || interval === state.interval) return;

    state.interval = interval;

    await refreshApplication();

}


/* =====================================================
   REFRESH APPLICATION
===================================================== */

async function refreshApplication() {

    if (state.loading) return;

    state.loading = true;

    try {

        state.error = null;

        setStatus("● UPDATING MARKET DATA...");

        await loadCandles();

        calculateAllIndicators();

        updateDashboard();

        // Run a historical backtest.

        try {

            state.backtest = runBacktest(state.candles);

            renderBacktest(state.backtest);

        } catch (error) {

            console.warn(
                "Backtest unavailable:",
                error.message
            );

        }

        state.lastUpdate = Date.now();

    } catch (error) {

        handleError(error);

    } finally {

        state.loading = false;

    }

}


/* =====================================================
   RENDER BACKTEST RESULTS
===================================================== */

function renderBacktest(result) {

    if (!result) return;

    setText(
        "backtestReturn",
        formatNumber(result.totalReturn) + "%"
    );

    setText(
        "backtestWinRate",
        formatNumber(result.winRate) + "%"
    );

    setText(
        "backtestTrades",
        result.totalTrades
    );

    setText(
        "backtestDrawdown",
        formatNumber(result.maxDrawdown) + "%"
    );

    setText(
        "backtestProfitFactor",
        Number.isFinite(result.profitFactor)
            ? formatNumber(result.profitFactor)
            : "∞"
    );

    setText(
        "backtestCapital",
        formatPrice(result.finalCapital)
    );

}


/* =====================================================
   EXPORT BACKTEST TRADES
===================================================== */

function downloadBacktest() {

    if (!state.backtest) {

        alert("No backtest results available.");

        return;

    }

    const trades = exportTradeHistory(
        state.backtest
    );

    const csvRows = [

        [
            "Direction",
            "Entry",
            "Exit",
            "Profit",
            "Fees",
            "Reason",
            "Candles Held"
        ],

        ...trades.map(trade => [

            trade.direction,

            trade.entry,

            trade.exit,

            trade.profit,

            trade.fees,

            trade.reason,

            trade.candlesHeld

        ])

    ];

    const csv = csvRows

        .map(row => row.join(","))

        .join("\n");

    const blob = new Blob(

        [csv],

        { type: "text/csv;charset=utf-8;" }

    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = "sigma-backtest.csv";

    link.click();

    URL.revokeObjectURL(url);

}


/* =====================================================
   INITIALIZE USER CONTROLS
===================================================== */

function initializeControls() {

    const asset = $("asset");

    if (asset) {

        asset.addEventListener("change", event => {

            selectAsset(event.target.value);

        });

    }

    const interval = $("interval");

    if (interval) {

        interval.addEventListener("change", event => {

            changeInterval(event.target.value);

        });

    }

    const refresh = $("refresh");

    if (refresh) {

        refresh.addEventListener("click", () => {

            refreshApplication();

        });

    }

    const exportButton = $("exportBacktest");

    if (exportButton) {

        exportButton.addEventListener("click", downloadBacktest);

    }

    // Chart type controls.

    document.querySelectorAll(".chart-type").forEach(button => {

        button.addEventListener("click", () => {

            setChartType(button.dataset.type);

        });

    });

    const reset = $("resetChart");

    if (reset) {

        reset.addEventListener("click", resetCharts);

    }

}


/* =====================================================
   AUTOMATIC REFRESH
===================================================== */

let refreshTimer = null;

function startAutomaticRefresh() {

    if (refreshTimer) {

        clearInterval(refreshTimer);

    }

    refreshTimer = setInterval(() => {

        refreshApplication();

    }, CONFIG.REFRESH_INTERVAL);

}


/* =====================================================
   START APPLICATION
===================================================== */

async function startApplication() {

    try {

        setStatus("● INITIALIZING SIGMA...");

        initializeControls();

        await loadMarkets();

        await refreshApplication();

        startAutomaticRefresh();

        console.log("SIGMA 3.0 initialized.");

    } catch (error) {

        handleError(error);

    }

}


/* =====================================================
   APPLICATION START
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    startApplication
);


/* =====================================================
   CLEANUP
===================================================== */

window.addEventListener("beforeunload", () => {

    if (refreshTimer) {

        clearInterval(refreshTimer);

        refreshTimer = null;

    }

});
