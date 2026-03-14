const fs = require('fs');
const path = require('path');
const { generateRiskRadarChart, generatePrincipleEvaluatorHeatmap } = require('../services/chartGenerationService');

async function verifyCharts() {
    console.log('🚀 Starting Chart Verification...');

    // Mock Data
    const mockScoringOverall = {
        'TRANSPARENCY': { avg: 1.5, averageRisk: 1.5 },
        'ACCOUNTABILITY': { avg: 3.2, averageRisk: 3.2 },
        'FAIRNESS': { avg: 2.1, averageRisk: 2.1 },
        'PRIVACY': { avg: 0.5, averageRisk: 0.5 },
        'SAFETY': { avg: 4.0, averageRisk: 4.0 }
    };

    const mockScoringTable = {
        'TRANSPARENCY': {
            evaluators: [
                { userId: 'user1', score: 1 },
                { userId: 'user2', score: 2 }
            ]
        },
        'ACCOUNTABILITY': {
            evaluators: [
                { userId: 'user1', score: 3 },
                { userId: 'user2', score: 3.5 }
            ]
        }
    };

    const mockEvaluators = [
        { userId: 'user1', name: 'Alice', role: 'Expert' },
        { userId: 'user2', name: 'Bob', role: 'Reviewer' }
    ];

    try {
        // Test Radar Chart
        console.log('📊 Testing Radar Chart...');
        const radarBuffer = await generateRiskRadarChart(mockScoringOverall);
        if (radarBuffer && radarBuffer.length > 0) {
            fs.writeFileSync('verify_radar.png', radarBuffer);
            console.log('✅ Radar Chart generated (verify_radar.png)');
        } else {
            console.error('❌ Radar Chart buffer is empty');
        }

        // Test Heatmap
        console.log('📊 Testing Heatmap...');
        const heatmapBuffer = await generatePrincipleEvaluatorHeatmap(mockScoringTable, mockEvaluators);
        if (heatmapBuffer && heatmapBuffer.length > 0) {
            fs.writeFileSync('verify_heatmap.png', heatmapBuffer);
            console.log('✅ Heatmap generated (verify_heatmap.png)');
        } else {
            console.error('❌ Heatmap buffer is empty');
        }

    } catch (error) {
        console.error('❌ Verification Failed:', error);
    }
}

verifyCharts();
