const { spawn } = require('child_process');
const electronPath = require('electron');

// AGGRESSIVELY DELETE THE VARIABLE THAT FORCES NODE MODE
delete process.env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ['.'], {
    stdio: 'inherit',
    env: process.env,
    windowsHide: false
});

child.on('close', (code) => {
    process.exit(code);
});
