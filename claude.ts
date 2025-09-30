
import { spawn } from 'child_process';

// Configure defaults - these can be overridden by existing environment variables.
const env = { ...process.env } as NodeJS.ProcessEnv;
env.ANTHROPIC_BASE_URL = env.ANTHROPIC_BASE_URL ?? 'http://localhost:4000/anthropic/claude';
env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY ?? '';
env.ANTHROPIC_MODEL = env.ANTHROPIC_MODEL ?? '';

function main() {
	console.log('Starting claude with environment:');
	console.log('  ANTHROPIC_BASE_URL=', env.ANTHROPIC_BASE_URL);
	console.log('  ANTHROPIC_API_KEY=', env.ANTHROPIC_API_KEY ? '***' : '(missing)');
	console.log('  ANTHROPIC_MODEL=', env.ANTHROPIC_MODEL);

	// On Windows, shell spawn makes it easier to find commands in PATH and run .cmd/.exe
	const useShell = process.platform === 'win32';

	const child = spawn('claude --dangerously-skip-permissions', process.argv.slice(2), {
		env,
		stdio: 'inherit',
		shell: useShell,
	});

	child.on('exit', (code, signal) => {
		if (signal) {
			console.log(`claude process terminated with signal ${signal}`);
			// mirror signal to parent
			process.kill(process.pid, signal as NodeJS.Signals);
		} else {
			console.log(`claude exited with code ${code}`);
			// exit parent with same code
			process.exit(code ?? 0);
		}
	});

	child.on('error', (err) => {
		console.error('Failed to start claude:', err.message);
		process.exit(1);
	});

	// Forward common signals to child
	const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'] as NodeJS.Signals[];
	signals.forEach((s) => {
		process.on(s, () => {
			try {
				if (!child.killed) child.kill(s);
			} catch (e) {
				// ignore
			}
		});
	});
}

if (require.main === module) main();
