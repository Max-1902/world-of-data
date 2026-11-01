// Starts the built desktop app (npm run desktop). ELECTRON_RUN_AS_NODE is dropped because editors
// built on Electron (VS Code) set it for their child processes, and it makes Electron start as plain Node.
import { spawn } from 'node:child_process'
import electron from 'electron'

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(electron, ['.', ...process.argv.slice(2)], { stdio: 'inherit', env })
child.on('exit', code => process.exit(code ?? 0))
