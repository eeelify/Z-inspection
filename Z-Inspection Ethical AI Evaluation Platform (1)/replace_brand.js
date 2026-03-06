const fs = require('fs');
const path = require('path');

const directories = [
    path.join(__dirname, 'frontend'),
    path.join(__dirname, 'backend')
];

const extensions = ['.js', '.jsx', '.ts', '.tsx', '.html', '.json'];

function replaceInFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    // First handle terms with registered trademark
    let newContent = content.replace(/Z-Inspection®/g, 'Ethical AI Analysis');
    // Then handle standard references, preserving case ideally, but globally as Ethical AI Analysis
    newContent = newContent.replace(/Z-Inspection/g, 'Ethical AI Analysis');
    newContent = newContent.replace(/Z-inspection/g, 'Ethical AI Analysis');
    newContent = newContent.replace(/z-inspection/g, 'ethical-ai-analysis');

    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Updated: ${filePath}`);
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'build') {
            continue;
        }
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walkDir(fullPath);
        } else if (stat.isFile()) {
            const ext = path.extname(fullPath);
            if (extensions.includes(ext)) {
                replaceInFile(fullPath);
            }
        }
    }
}

directories.forEach(dir => {
    if (fs.existsSync(dir)) {
        walkDir(dir);
    }
});

console.log('Replacement complete.');
