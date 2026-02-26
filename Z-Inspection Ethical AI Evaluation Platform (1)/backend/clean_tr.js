const fs = require('fs');
const path = require('path');

const filesToClean = [
    'ethical_questions.json',
    'question_structure.json',
    'scripts/seedEthicalExpertQuestions.js',
    'scripts/seedTechnicalExpertQuestions.js',
    'scripts/seedMedicalExpertQuestions.js',
    'scripts/seedLegalExpertQuestions.js',
    'scripts/seedGeneralQuestions.js',
    'scripts/seedEducationExpertQuestions.js'
];

filesToClean.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) {
        console.log(`Skipping ${file}, not found.`);
        return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let originalContent = content;

    if (file.endsWith('.json')) {
        // For JSON files, parse and modify object
        const obj = JSON.parse(content);
        const removeTr = (o) => {
            if (Array.isArray(o)) {
                o.forEach(removeTr);
            } else if (o !== null && typeof o === 'object') {
                if (o.hasOwnProperty('tr')) delete o.tr;
                if (o.hasOwnProperty('principleTr')) delete o.principleTr;

                // Also strip " / Turkish" from "en"
                if (o.hasOwnProperty('en') && typeof o.en === 'string') {
                    if (o.en.includes(' / ')) {
                        o.en = o.en.split(' / ')[0].trim();
                    }
                }
                Object.values(o).forEach(removeTr);
            }
        };
        removeTr(obj);
        content = JSON.stringify(obj, null, 2);
    } else {
        // JS files with regex
        // 1. Remove tr and principleTr keys
        const trKeyRegex = /(?:tr|principleTr)\s*:\s*(['"`])(?:(?!\1)[^\\]|\\.)*\1\s*,?/g;
        content = content.replace(trKeyRegex, '');

        // 2. Remove " / Turkish" part from "en" values
        // Matches en: 'English / Turkish' -> Replaces with en: 'English'
        const enCleanupRegex = /(en\s*:\s*(['"`])(?:(?!\2)[^\\]|\\.)*?)\s*\/\s*(?:(?!\2)[^\\]|\\.)*?\2/g;
        content = content.replace(enCleanupRegex, "$1$2");
    }

    if (content !== originalContent) {
        fs.writeFileSync(fullPath, content);
        console.log(`✅ Cleaned ${file}`);
    } else {
        console.log(`ℹ️ No changes needed for ${file}`);
    }
});
