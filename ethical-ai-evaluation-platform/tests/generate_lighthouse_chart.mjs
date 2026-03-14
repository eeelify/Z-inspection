import fs from 'fs';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

const width = 800;
const height = 600;
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

(async () => {
    const configuration = {
        type: 'line',
        data: {
            labels: ['Run 1', 'Run 2', 'Run 3', 'Run 4', 'Run 5'],
            datasets: [{
                label: 'Score Trend',
                data: [65, 59, 80, 81, 95],
                fill: false,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        }
    };

    const image = await chartJSNodeCanvas.renderToBuffer(configuration);
    fs.writeFileSync('tests/test_trend_chart.png', image);
    console.log('Trend chart created.');
})();
