const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const viteCli = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');

const childProcesses = new Set();
let shuttingDown = false;
let exitCode = 0;
let forcedExitTimer = null;

function maybeExit() {
  if (!shuttingDown || childProcesses.size > 0) {
    return;
  }

  if (forcedExitTimer) {
    clearTimeout(forcedExitTimer);
    forcedExitTimer = null;
  }

  process.exit(exitCode);
}

function spawnProcess(name, command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
    cwd: projectRoot,
  });

  childProcesses.add(child);

  child.on('exit', (code, signal) => {
    childProcesses.delete(child);

    if (shuttingDown) {
      maybeExit();
      return;
    }

    shuttingDown = true;
    exitCode = typeof code === 'number' ? code : signal === 'SIGINT' ? 130 : 1;
    shutdown(signal || (code === 0 ? 'SIGTERM' : 'SIGINT'));
  });

  child.on('error', (error) => {
    console.error(`[dev] Failed to start ${name}:`, error);
    if (!shuttingDown) {
      shuttingDown = true;
      exitCode = 1;
      shutdown('SIGTERM');
    }
  });

  return child;
}

function shutdown(signal = 'SIGINT') {
  for (const child of childProcesses) {
    if (child.killed) {
      continue;
    }

    try {
      child.kill(signal);
    } catch (error) {
      console.error('[dev] Failed to stop child process:', error);
    }
  }

  setTimeout(() => {
    for (const child of childProcesses) {
      if (child.killed) {
        continue;
      }

      try {
        child.kill('SIGTERM');
      } catch (error) {
        console.error('[dev] Failed to terminate child process:', error);
      }
    }
  }, 500);

  setTimeout(() => {
    for (const child of childProcesses) {
      if (child.killed) {
        continue;
      }

      try {
        child.kill('SIGKILL');
      } catch (error) {
        console.error('[dev] Failed to force kill child process:', error);
      }
    }
  }, 2000);

  if (!forcedExitTimer) {
    forcedExitTimer = setTimeout(() => {
      process.exit(exitCode);
    }, 3000);
  }

  maybeExit();
}

process.on('SIGINT', () => {
  if (shuttingDown) {
    process.exit(130);
  }

  shuttingDown = true;
  exitCode = 130;
  shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  if (shuttingDown) {
    process.exit(143);
  }

  shuttingDown = true;
  exitCode = 143;
  shutdown('SIGTERM');
});

if (!fs.existsSync(viteCli)) {
  console.error('[dev] Missing Vite CLI. From the project root, run: npm install');
  process.exit(1);
}

spawnProcess('api', process.execPath, ['--watch', 'api/server.cjs']);
// Run the local Vite binary (same as `npm run dev:web`) so cwd and plugins
// like @tailwindcss/vite resolve reliably; avoids nested `npm run`.
spawnProcess('web', process.execPath, [viteCli]);
