const fs = require('fs');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

const width = 800; // px
const height = 600; // px
const backgroundColour = 'white';
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour });

async function generateChart() {
    const configuration = {
        type: 'bar',
        data: {
            labels: ['Performance', 'Accessibility', 'Best Practices', 'SEO', 'PWA'],
            datasets: [{
                label: 'Lighthouse Scores',
                data: [90, 85, 92, 88, 75], // Example data
                backgroundColor: [
                    'rgba(255, 99, 132, 0.2)',
                    'rgba(54, 162, 235, 0.2)',
                    'rgba(255, 206, 86, 0.2)',
                    'rgba(75, 192, 192, 0.2)',
                    'rgba(153, 102, 255, 0.2)',
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)',
                ],
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    };

    const image = await chartJSNodeCanvas.renderToBuffer(configuration);
    fs.writeFileSync('tests/lighthouse_chart.png', image);
    console.log('Lighthouse chart created at tests/lighthouse_chart.png');
}

generateChart();
