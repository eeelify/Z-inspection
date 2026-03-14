const fs = require('fs');
const path = require('path');

const files = [
    'frontend/src/components/UserDashboard.tsx',
    'frontend/src/components/UseCaseOwnerDashboard.tsx',
    'frontend/src/components/UseCaseDetail.tsx',
    'frontend/src/components/ProjectDetail.tsx'
];

files.forEach(f => {
    const fullPath = path.join(__dirname, f);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        const orig = content;

        // Remove interface property
        content = content.replace(/\s*questionTr\??:\s*string;/g, '');

        // Remove if (q.questionTr) blocks (string building)
        content = content.replace(/\s*if\s*\([^)]*\.questionTr\)\s*\{\s*[^}]*\.questionTr[^}]*\s*\}/g, '');

        // Remove JSX blocks starting with {question.questionTr && (...)}
        content = content.replace(/\s*\{[^}]*\.questionTr\s*&&\s*\([^)]+\)\s*\}/g, '');

        if (content !== orig) {
            fs.writeFileSync(fullPath, content);
            console.log('Cleaned ' + f);
        }
    }
});
