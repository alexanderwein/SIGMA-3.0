
/*
=========================================================
 SIGMA 3.0 — INTERACTIVE CHART ENGINE
 PART 1: SETUP AND CONFIGURATION
=========================================================
*/

import { CONFIG } from "../config.js";

let priceChart = null;
let rsiChart = null;
let macdChart = null;

let candleSeries = null;
let lineSeries = null;

let ema20Series = null;
let ema50Series = null;
let volumeSeries = null;
let forecastSeries = null;

let rsiSeries = null;
let rsiUpperSeries = null;
let rsiLowerSeries = null;

let macdLineSeries = null;
let macdSignalSeries = null;
let macdHistogramSeries = null;

let currentChartType = "candles";
let currentCandles = [];
let currentIndicators = null;

let resizeObserver = null;


/* =====================================================
   LIBRARY VALIDATION
===================================================== */

function getLibrary() {

    if (!window.LightweightCharts) {

        throw new Error(
            "Lightweight Charts library not loaded."
        );

    }

    return window.LightweightCharts;

}


/* =====================================================
   COMMON CHART OPTIONS
===================================================== */

function commonOptions(container) {

    return {

        width: container.clientWidth,

        height: container.clientHeight,

        layout: {

            background: {
                type: "solid",
                color: CONFIG.CHART.BACKGROUND
            },

            textColor: CONFIG.CHART.TEXT_COLOR,

            fontFamily: "Inter, Arial, sans-serif",

            fontSize: 11

        },

        grid: {

            vertLines: {
                color: CONFIG.CHART.GRID_COLOR
            },

            horzLines: {
                color: CONFIG.CHART.GRID_COLOR
            }

        },

        crosshair: {

            mode: 0,

            vertLine: {
                color: CONFIG.CHART.CROSSHAIR_COLOR,
                width: 1,
                style: 2,
                labelBackgroundColor: "#24364d"
            },

            horzLine: {
                color: CONFIG.CHART.CROSSHAIR_COLOR,
                width: 1,
                style: 2,
                labelBackgroundColor: "#24364d"
            }

        },

        rightPriceScale: {

            borderColor: CONFIG.CHART.GRID_COLOR,

            scaleMargins: {
                top: 0.08,
                bottom: 0.12
            }

        },

        timeScale: {

            borderColor: CONFIG.CHART.GRID_COLOR,

            timeVisible: true,

            secondsVisible: false,

            rightOffset: 5,

            barSpacing: 7,

            fixLeftEdge: false

        },

        handleScroll: {

            mouseWheel: true,

            pressedMouseMove: true,

            horzTouchDrag: true,

            vertTouchDrag: false

        },

        handleScale: {

            axisPressedMouseMove: true,

            mouseWheel: true,

            pinch: true

        }

    };

}


/* =====================================================
   FORMAT HELPERS
===================================================== */

function formatNumber(value) {

    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(Number(value))
    ) {

        return "—";

    }

    return Number(value).toLocaleString("en-US", {

        maximumFractionDigits: 8

    });

}


function formatTime(time) {

    let date;

    if (typeof time === "number") {

        date = new Date(time * 1000);

    } else if (time && typeof time === "object") {

        date = new Date(
            time.year,
            time.month - 1,
            time.day
        );

    } else {

        return "—";

    }

    return date.toLocaleString();

}


/* =====================================================
   CROSSHAIR INFORMATION PANEL
===================================================== */

function createCrosshairPanel(container) {

    let panel = container.querySelector(
        ".sigma-crosshair-info"
    );

    if (panel) return panel;

    container.style.position = "relative";

    panel = document.createElement("div");

    panel.className = "sigma-crosshair-info";

    panel.style.cssText = `

        position:absolute;
        top:10px;
        left:10px;
        z-index:10;
        pointer-events:none;
        padding:10px 12px;
        background:rgba(8,14,25,.94);
        border:1px solid #24364d;
        border-radius:7px;
        color:#e9f1fc;
        font-family:Inter,Arial,sans-serif;
        font-size:11px;
        line-height:1.8;
        min-width:190px;
        box-shadow:0 4px 15px rgba(0,0,0,.25);

    `;

    panel.innerHTML = `

        <div style="color:#91a4bd">
            MOVE CURSOR OVER CHART
        </div>

        <div>O: —</div>
        <div>H: —</div>
        <div>L: —</div>
        <div>C: —</div>

    `;

    container.appendChild(panel);

    return panel;

}

/* =====================================================
   CROSSHAIR DETAILS
===================================================== */

function subscribePriceCrosshair(container) {

    const panel = createCrosshairPanel(container);

    priceChart.subscribeCrosshairMove(param => {

        if (
            !param ||
            !param.time ||
            !param.seriesData
        ) {

            panel.innerHTML = `
                <div style="color:#91a4bd">
                    MOVE CURSOR OVER CHART
                </div>
            `;

            return;

        }

        const candle = candleSeries
            ? param.seriesData.get(candleSeries)
            : null;

        const line = lineSeries
            ? param.seriesData.get(lineSeries)
            : null;

        const ema20 = ema20Series
            ? param.seriesData.get(ema20Series)
            : null;

        const ema50 = ema50Series
            ? param.seriesData.get(ema50Series)
            : null;

        const volume = volumeSeries
            ? param.seriesData.get(volumeSeries)
            : null;

        const price = candle || line;

        if (!price) return;

        const open = candle ? candle.open : null;
        const high = candle ? candle.high : null;
        const low = candle ? candle.low : null;

        const close = candle
            ? candle.close
            : line.value;

        const direction = candle
            ? candle.close >= candle.open
            : true;

        const color = direction
            ? CONFIG.CHART.CANDLE_UP
            : CONFIG.CHART.CANDLE_DOWN;

        panel.innerHTML = `

            <div style="color:#91a4bd;margin-bottom:5px">
                ${formatTime(param.time)}
            </div>

            <div style="color:${color};font-weight:700">
                ${currentChartType === "candles"
                    ? "CANDLE DATA"
                    : "PRICE DATA"}
            </div>

            ${candle ? `

                <div>OPEN:
                    <b>${formatNumber(open)}</b>
                </div>

                <div>HIGH:
                    <b>${formatNumber(high)}</b>
                </div>

                <div>LOW:
                    <b>${formatNumber(low)}</b>
                </div>

                <div>CLOSE:
                    <b style="color:${color}">
                        ${formatNumber(close)}
                    </b>
                </div>

            ` : `

                <div>PRICE:
                    <b>${formatNumber(close)}</b>
                </div>

            `}

            <div style="color:${CONFIG.CHART.EMA_20}">
                EMA 20: ${formatNumber(ema20?.value)}
            </div>

            <div style="color:${CONFIG.CHART.EMA_50}">
                EMA 50: ${formatNumber(ema50?.value)}
            </div>

            <div style="color:#91a4bd">
                VOLUME: ${formatNumber(volume?.value)}
            </div>

        `;

    });

}


/* =====================================================
   INITIALIZE MAIN PRICE CHART
===================================================== */

function initializePriceChart() {

    const library = getLibrary();

    const container = document.getElementById("priceChart");

    if (!container) {

        throw new Error(
            "Price chart container not found."
        );

    }

    priceChart = library.createChart(
        container,
        commonOptions(container)
    );

    createCrosshairPanel(container);

    initializePriceSeries();

    subscribePriceCrosshair(container);

}


/* =====================================================
   INITIALIZE PRICE SERIES
===================================================== */

function initializePriceSeries() {

    if (!priceChart) return;

    if (candleSeries) {

        priceChart.removeSeries(candleSeries);

        candleSeries = null;

    }

    if (lineSeries) {

        priceChart.removeSeries(lineSeries);

        lineSeries = null;

    }

    if (currentChartType === "candles") {

        candleSeries = priceChart.addCandlestickSeries({

            upColor: CONFIG.CHART.CANDLE_UP,

            downColor: CONFIG.CHART.CANDLE_DOWN,

            borderUpColor: CONFIG.CHART.CANDLE_UP,

            borderDownColor: CONFIG.CHART.CANDLE_DOWN,

            wickUpColor: CONFIG.CHART.CANDLE_UP,

            wickDownColor: CONFIG.CHART.CANDLE_DOWN,

            priceLineVisible: true,

            lastValueVisible: true

        });

    } else {

        lineSeries = priceChart.addLineSeries({

            color: CONFIG.CHART.CANDLE_UP,

            lineWidth: 2,

            priceLineVisible: true,

            lastValueVisible: true

        });

    }

    ema20Series = priceChart.addLineSeries({

        color: CONFIG.CHART.EMA_20,

        lineWidth: 2,

        title: "EMA 20",

        priceLineVisible: false

    });

    ema50Series = priceChart.addLineSeries({

        color: CONFIG.CHART.EMA_50,

        lineWidth: 2,

        title: "EMA 50",

        priceLineVisible: false

    });

    volumeSeries = priceChart.addHistogramSeries({

        color: "#57b8ff",

        priceFormat: {
            type: "volume"
        },

        priceScaleId: "volume",

        priceLineVisible: false,

        lastValueVisible: false

    });

    priceChart.priceScale("volume").applyOptions({

        scaleMargins: {
            top: 0.82,
            bottom: 0
        }

    });

    forecastSeries = priceChart.addLineSeries({

        color: CONFIG.CHART.CROSSHAIR_COLOR,

        lineWidth: 2,

        lineStyle: 2,

        title: "Forecast",

        priceLineVisible: false,

        lastValueVisible: false,

        crosshairMarkerVisible: true

    });

}


/* =====================================================
   INITIALIZE RSI CHART
===================================================== */

function initializeRSIChart() {

    const library = getLibrary();

    const container = document.getElementById("rsiChart");

    if (!container) {

        throw new Error(
            "RSI chart container not found."
        );

    }

    rsiChart = library.createChart(
        container,
        commonOptions(container)
    );

    rsiSeries = rsiChart.addLineSeries({

        color: "#57b8ff",

        lineWidth: 2,

        title: "RSI 14"

    });

    rsiUpperSeries = rsiChart.addLineSeries({

        color: "#ff637c",

        lineWidth: 1,

        lineStyle: 2,

        title: "Overbought"

    });

    rsiLowerSeries = rsiChart.addLineSeries({

        color: "#32d49b",

        lineWidth: 1,

        lineStyle: 2,

        title: "Oversold"

    });

    rsiChart.priceScale("right").applyOptions({

        autoScale: false,

        scaleMargins: {
            top: 0.05,
            bottom: 0.05
        }

    });

    rsiChart.priceScale("right").setAutoScale(false);

}


/* =====================================================
   INITIALIZE MACD CHART
===================================================== */

function initializeMACDChart() {

    const library = getLibrary();

    const container = document.getElementById("macdChart");

    if (!container) {

        throw new Error(
            "MACD chart container not found."
        );

    }

    macdChart = library.createChart(
        container,
        commonOptions(container)
    );

    macdHistogramSeries = macdChart.addHistogramSeries({

        title: "Histogram",

        priceLineVisible: false

    });

    macdLineSeries = macdChart.addLineSeries({

        color: "#57b8ff",

        lineWidth: 2,

        title: "MACD"

    });

    macdSignalSeries = macdChart.addLineSeries({

        color: "#e8c66b",

        lineWidth: 2,

        title: "Signal"

    });

}

/* =====================================================
   INITIALIZE ALL CHARTS
===================================================== */

export function initializeCharts() {

    if (priceChart || rsiChart || macdChart) {

        destroyCharts();

    }

    initializePriceChart();

    initializeRSIChart();

    initializeMACDChart();

    setupChartResize();

    setupChartControls();

    return true;

}


/* =====================================================
   CONVERT INDICATORS TO CHART DATA
===================================================== */

function indicatorData(candles, values) {

    if (
        !Array.isArray(candles) ||
        !Array.isArray(values)
    ) {

        return [];

    }

    return candles

        .map((candle, index) => ({

            time: candle.time,

            value: values[index]

        }))

        .filter(item =>

            item.time !== undefined &&

            Number.isFinite(item.value)

        );

}


/* =====================================================
   UPDATE PRICE CHART
===================================================== */

function updatePriceChart(candles, indicators) {

    if (!priceChart) return;

    if (currentChartType === "candles") {

        candleSeries.setData(

            candles.map(candle => ({

                time: candle.time,

                open: candle.open,

                high: candle.high,

                low: candle.low,

                close: candle.close

            }))

        );

    } else {

        lineSeries.setData(

            candles.map(candle => ({

                time: candle.time,

                value: candle.close

            }))

        );

    }

    ema20Series.setData(

        indicatorData(
            candles,
            indicators?.ema20
        )

    );

    ema50Series.setData(

        indicatorData(
            candles,
            indicators?.ema50
        )

    );

    volumeSeries.setData(

        candles.map(candle => ({

            time: candle.time,

            value: Number.isFinite(candle.volume)
                ? candle.volume
                : 0,

            color: candle.close >= candle.open

                ? "rgba(50,212,155,0.45)"

                : "rgba(255,99,124,0.45)"

        }))

    );

    forecastSeries.setData([]);

    priceChart.timeScale().fitContent();

}


/* =====================================================
   UPDATE FORECAST OVERLAY
===================================================== */

/*
Expected format:

[
    { time: 1700000000, value: 65000 },
    { time: 1700003600, value: 65500 }
]

Time must be UNIX seconds.
*/

export function updateForecastChart(points) {

    if (
        !forecastSeries ||
        !Array.isArray(points)
    ) {

        return;

    }

    const validPoints = points

        .filter(point =>

            Number.isFinite(point.time) &&

            Number.isFinite(point.value)

        )

        .sort((a, b) => a.time - b.time);

    forecastSeries.setData(validPoints);

}


/* =====================================================
   UPDATE RSI CHART
===================================================== */

function updateRSIChart(candles, indicators) {

    if (!rsiChart) return;

    rsiSeries.setData(

        indicatorData(
            candles,
            indicators?.rsi
        )

    );

    if (!candles.length) return;

    const first = candles[0].time;

    const last = candles[candles.length - 1].time;

    rsiUpperSeries.setData([

        { time: first, value: 70 },

        { time: last, value: 70 }

    ]);

    rsiLowerSeries.setData([

        { time: first, value: 30 },

        { time: last, value: 30 }

    ]);

    rsiChart.timeScale().fitContent();

}



/* =====================================================
   UPDATE MACD CHART — SIGMA 3.1
   Supports both technical.js and backtestEngine.js
===================================================== */

function updateMACDChart(candles, indicators) {

    if (!macdChart || !Array.isArray(candles)) {
        return;
    }

    if (!indicators || typeof indicators !== "object") {

        macdLineSeries.setData([]);
        macdSignalSeries.setData([]);
        macdHistogramSeries.setData([]);

        return;
    }

    /*
       Normalize MACD structures.

       Technical engine:
       indicators.macd
       indicators.macdSignal
       indicators.macdHistogram

       Backtest engine:
       indicators.macd.line
       indicators.macd.signal
       indicators.macd.histogram
    */

    const macdLine = Array.isArray(indicators.macd)
        ? indicators.macd
        : indicators.macd?.line;

    const macdSignal = Array.isArray(indicators.macdSignal)
        ? indicators.macdSignal
        : indicators.macd?.signal;

    const macdHistogram = Array.isArray(indicators.macdHistogram)
        ? indicators.macdHistogram
        : indicators.macd?.histogram;

    // MACD line

    macdLineSeries.setData(
        indicatorData(candles, macdLine)
    );

    // Signal line

    macdSignalSeries.setData(
        indicatorData(candles, macdSignal)
    );

    // MACD histogram

    const histogram = candles.map((candle, index) => {

        const value = macdHistogram?.[index];

        if (!Number.isFinite(value)) {
            return null;
        }

        return {

            time: candle.time,

            value,

            color: value >= 0
                ? "rgba(50,212,155,0.7)"
                : "rgba(255,99,124,0.7)"

        };

    }).filter(Boolean);

    macdHistogramSeries.setData(histogram);

    macdChart.timeScale().fitContent();

}

/* =====================================================
   UPDATE ALL CHARTS
===================================================== */

export function updateCharts(

    candles,

    indicators,

    forecastPoints = []

) {

    if (!Array.isArray(candles) || candles.length < 2) {

        throw new Error("Insufficient chart data.");

    }

    if (!priceChart || !rsiChart || !macdChart) {

        initializeCharts();

    }

    currentCandles = candles;

    currentIndicators = indicators;

    updatePriceChart(candles, indicators);

    updateRSIChart(candles, indicators);

    updateMACDChart(candles, indicators);

    if (Array.isArray(forecastPoints) && forecastPoints.length) {

        updateForecastChart(forecastPoints);

    }

}

/* =====================================================
   CHANGE CHART TYPE
===================================================== */

export function setChartType(type) {

    if (!["candles", "line"].includes(type)) {

        return;

    }

    if (currentChartType === type) {

        return;

    }

    currentChartType = type;

    if (!priceChart) return;

    initializePriceSeries();

    if (currentCandles.length) {

        updatePriceChart(
            currentCandles,
            currentIndicators
        );

    }

    document.querySelectorAll(".chart-type").forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.type === type
        );

    });

}


/* =====================================================
   RESET ZOOM
===================================================== */

export function resetCharts() {

    if (priceChart) {

        priceChart.timeScale().fitContent();

    }

    if (rsiChart) {

        rsiChart.timeScale().fitContent();

    }

    if (macdChart) {

        macdChart.timeScale().fitContent();

    }

}


/* =====================================================
   CHART BUTTON EVENTS
===================================================== */

function setupChartControls() {

    document.querySelectorAll(".chart-type").forEach(button => {

        button.onclick = () => {

            setChartType(button.dataset.type);

        };

    });

    const resetButton =
        document.getElementById("resetChart");

    if (resetButton) {

        resetButton.onclick = resetCharts;

    }

}


/* =====================================================
   RESPONSIVE CHART RESIZING
===================================================== */

function setupChartResize() {

    if (resizeObserver) {

        resizeObserver.disconnect();

    }

    if (typeof ResizeObserver === "undefined") {

        window.addEventListener(
            "resize",
            resizeCharts
        );

        return;

    }

    resizeObserver = new ResizeObserver(() => {

        resizeCharts();

    });

    [

        "priceChart",
        "rsiChart",
        "macdChart"

    ].forEach(id => {

        const container = document.getElementById(id);

        if (container) {

            resizeObserver.observe(container);

        }

    });

}


/* =====================================================
   RESIZE ALL CHARTS
===================================================== */

function resizeCharts() {

    const charts = [

        ["priceChart", priceChart],

        ["rsiChart", rsiChart],

        ["macdChart", macdChart]

    ];

    charts.forEach(([id, chart]) => {

        const container = document.getElementById(id);

        if (!chart || !container) return;

        const width = container.clientWidth;

        const height = container.clientHeight;

        if (width > 0 && height > 0) {

            chart.resize(width, height);

        }

    });

}


/* =====================================================
   DESTROY CHARTS
===================================================== */

export function destroyCharts() {

    if (resizeObserver) {

        resizeObserver.disconnect();

        resizeObserver = null;

    }

    [

        priceChart,

        rsiChart,

        macdChart

    ].forEach(chart => {

        if (chart) {

            chart.remove();

        }

    });

    priceChart = null;

    rsiChart = null;

    macdChart = null;

    candleSeries = null;

    lineSeries = null;

    ema20Series = null;

    ema50Series = null;

    volumeSeries = null;

    forecastSeries = null;

    rsiSeries = null;

    rsiUpperSeries = null;

    rsiLowerSeries = null;

    macdLineSeries = null;

    macdSignalSeries = null;

    macdHistogramSeries = null;

    currentCandles = [];

    currentIndicators = null;

}


/* =====================================================
   CHART STATUS
===================================================== */

export function getChartStatus() {

    return {

        initialized: Boolean(

            priceChart &&

            rsiChart &&

            macdChart

        ),

        chartType: currentChartType,

        candleCount: currentCandles.length

    };

}
