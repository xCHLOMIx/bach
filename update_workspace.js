const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.ts')) results.push(file);
        }
    });
    return results;
}

const files = walk('app/api');
files.forEach(file => {
    if (file.includes('auth') || file.includes('members')) {
        return;
    }
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('user._id')) {
        content = content.replace(/user\._id/g, 'user.workspaceId');
        fs.writeFileSync(file, content);
        console.log('Updated ' + file);
    }
});
