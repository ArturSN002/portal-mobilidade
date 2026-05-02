const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\asn03\\Downloads\\Maestro V9.2.7\\GitHub Pages';
const estudantePath = path.join(dir, 'estudante.js');
const inscricaoPath = path.join(dir, 'inscricao.js');

const allLines = fs.readFileSync(estudantePath, 'utf8').split(/\r?\n/);

// Find the start of the stepper logic
const startIndex = allLines.findIndex(line => line.includes('9. MÓDULO SMART STEPPER — INSCRIÇÃO NATIVA (V10.1)'));

if (startIndex === -1) {
    console.error('Could not find the start of the stepper logic.');
    process.exit(1);
}

// Ensure we don't grab the DOMContentLoaded if it's outside. But wait, in estudante.js, the DOMContentLoaded with carregarListasInscricao is inside this block (lines 1292-1307). 
// Wait, the previous lines were up to 1832. I'll just split at startIndex - 1.

const estudanteLines = allLines.slice(0, startIndex - 1);
let inscricaoLines = allLines.slice(startIndex - 1);

// Add the new wrapper function to inscricaoLines
const wrapperFunction = `
// ========================================================================
// FUNÇÃO WRAPPER DE INICIALIZAÇÃO
// ========================================================================

function abrirNovaInscricao() {
    switchView('view-inscricao');
    carregarListasInscricao();
}
`;

inscricaoLines.push(wrapperFunction);

fs.writeFileSync(inscricaoPath, inscricaoLines.join('\n'), 'utf8');
fs.writeFileSync(estudantePath, estudanteLines.join('\n'), 'utf8');

console.log('Successfully extracted inscricao.js from estudante.js');
