/**
 * Report Prompt Builder Test (Gemini Integration Logic)
 * Refactored for lightweight runner compatibility
 */

function buildProjectPrompt(projectData, risks) {
    let prompt = `Analyze Project: ${projectData.title}\n`;
    prompt += `Description: ${projectData.description}\n\n`;

    prompt += `## IDENTIFIED RISKS\n`;
    risks.forEach(r => {
        prompt += `- Principle: ${r.principle} | Score: ${r.score} | Risk Level: ${r.level}\n`;
    });

    return prompt;
}

describe('Gemini Prompt Builder', () => {

    test('should correctly format project and risk data into prompt', async () => {
        const mockProject = {
            title: "AI Diagnostix",
            description: "An AI system for skin cancer detection."
        };

        const mockRisks = [
            { principle: "Transparency", score: 0.8, level: "High" },
            { principle: "Fairness", score: 0.2, level: "Low" }
        ];

        const output = buildProjectPrompt(mockProject, mockRisks);

        // Manual inclusion checks
        expect(output.includes("Analyze Project: AI Diagnostix")).toBe(true);
        expect(output.includes("Description: An AI system for skin cancer detection.")).toBe(true);
        expect(output.includes("Principle: Transparency | Score: 0.8 | Risk Level: High")).toBe(true);
        expect(output.includes("Principle: Fairness | Score: 0.2 | Risk Level: Low")).toBe(true);
    });

    test('should handle empty risk list gracefully', async () => {
        const mockProject = { title: "Safe AI", description: "Simple rules." };
        const output = buildProjectPrompt(mockProject, []);

        expect(output.includes("Analyze Project: Safe AI")).toBe(true);
        expect(output.includes("Principle:")).toBe(false); // Should NOT have risks
    });

});
