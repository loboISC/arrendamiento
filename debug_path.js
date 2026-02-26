const fs = require('fs');
const path = require('path');

const dbPath = "C:\\Users\\siste\\arrendamiento\\pdfs\\B-3BB06D59.pdf";
const fileName = path.basename(dbPath);
const storageDir = process.env.PDF_STORAGE_DIR || path.join(__dirname, 'pdfs'); // adjust __dirname since this is in root
const localPath = path.join(storageDir, fileName);

console.log('--- Diagnosis ---');
console.log('DB Path:', dbPath);
console.log('Exists like DB says?:', fs.existsSync(dbPath));
console.log('File Name:', fileName);
console.log('Storage Dir (Guess):', storageDir);
console.log('Local Path Resolution:', localPath);
console.log('Exists like controller logic?:', fs.existsSync(localPath));

// Also check relative to project root
const absoluteLocal = path.resolve(__dirname, 'pdfs', fileName);
console.log('Absolute Local Path:', absoluteLocal);
console.log('Exists at Absolute Local?:', fs.existsSync(absoluteLocal));
