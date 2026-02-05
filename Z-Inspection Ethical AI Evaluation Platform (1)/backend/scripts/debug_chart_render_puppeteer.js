const fs = require('fs');
const puppeteer = require('puppeteer');
const chartService = require('../services/chartGenerationServicePuppeteer');

async function testChartRender() {
    console.log('🧪 Starting MOCK Chart Render Test...');

    // Mock Data
    const byPrincipleTable = {
        "Fairness": {
            evaluators: [
                { userId: "u1", name: "User 1", score: 2 },
                { userId: "u2", name: "User 2", score: 3 }
            ]
        },
        "Transparency": {
            evaluators: [
                { userId: "u1", name: "User 1", score: 4 },
                { userId: "u2", name: "User 2", score: 1 }
            ]
        }
    };

    const evaluators = [
        { userId: "u1", name: "User 1", role: "Ethicist" },
        { userId: "u2", name: "User 2", role: "Dev" }
    ];

    console.log('\n🚀 Calling generatePrincipleEvaluatorHeatmap with MOCK DATA...');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const pngBuffer = await chartService.generatePrincipleEvaluatorHeatmap(
            byPrincipleTable,
            evaluators,
            browser
        );

        console.log('\n✅ RESULT:');
        console.log(`  - Buffer type: ${typeof pngBuffer}`);
        console.log(`  - Buffer length: ${pngBuffer ? pngBuffer.length : 'N/A'}`);
        console.log(`  - Is Buffer?: ${Buffer.isBuffer(pngBuffer)}`);

        if (pngBuffer && pngBuffer.length > 0) {
            fs.writeFileSync('test_mock_heatmap.png', pngBuffer);
            console.log('✅ Saved to test_mock_heatmap.png');
        } else {
            console.error('❌ Buffer is empty or invalid!');
        }

    } catch (error) {
        console.error('❌ Error during generation:', error);
    } finally {
        await browser.close();
    }
}

testChartRender();
