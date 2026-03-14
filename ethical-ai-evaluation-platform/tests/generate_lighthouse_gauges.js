const fs = require('fs');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

const width = 800;
const height = 400;
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

async function generateGauges() {
    // Mocking gauge generation with a simple chart for now
    const configuration = {
        type: 'doughnut',
        data: {
            labels: ['Pass', 'Fail'],
            datasets: [{
                data: [85, 15],
                backgroundColor: ['green', 'red']
            }]
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: 'Overall Compliance'
                }
            }
        }
    };

    const image = await chartJSNodeCanvas.renderToBuffer(configuration);
    fs.writeFileSync('tests/lighthouse_gauges.png', image);
    console.log('Lighthouse gauges created at tests/lighthouse_gauges.png');
}

generateGauges();
