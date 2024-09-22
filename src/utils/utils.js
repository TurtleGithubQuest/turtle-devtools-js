export const COLORS = {
    RESET: "\x1b[0m",
    GREEN: "\x1b[32m",
    YELLOW: "\x1b[33m",
    RED: "\x1b[31m",
    BLUE: "\x1b[34m",
    GREY: "\x1b[38;5;240m",
    CYAN: "\x1b[36m",
    MAGENTA: "\x1b[35m",
    WHITE: "\x1b[37m",
    BLACK: "\x1b[30m",
    BRIGHT_GREEN: "\x1b[38;5;82m",
    BRIGHT_YELLOW: "\x1b[38;5;226m",
    BRIGHT_RED: "\x1b[38;5;196m",
    BRIGHT_BLUE: "\x1b[38;5;75m",
    BRIGHT_CYAN: "\x1b[38;5;51m",
    BRIGHT_MAGENTA: "\x1b[38;5;201m",
    BRIGHT_WHITE: "\x1b[38;5;15m"
};

export function getTimestamp() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `[${hours}:${minutes}:${seconds}]`;
}

export function colorLog(color, message) {
    console.log(`${COLORS.BRIGHT_YELLOW}${getTimestamp()} ${COLORS[color]}${message}${COLORS.RESET}`);
}

/**
 * Runs a command synchronously and handles its output and errors.
 *
 * @param {string} command - The command to run.
 * @param {Array<string>} args - List of string arguments.
 * @param {string|null} cwd - Current working directory.
 * @param {boolean} isQuiet - If true, suppresses logging of command output.
 * @throws Will throw an error if the command fails to execute or returns a non-zero exit code.
 */
export function runCommand(command, args, cwd, isQuiet = false) {
    if (!isQuiet) {
        colorLog("BLUE", `Running command: ${command} ${args.join(" ")}`);
    }
    const proc = Bun.spawn([command, ...args], {
        cwd,
        encoding: 'utf-8',
        async onExit(proc, exitCode, signalCode, error) {
            if (error) {
                throw error;
            }
            if (exitCode !== 0) {
                throw new Error(`Command "${command}" exited with code ${exitCode}: ${proc.stderr}`);
            }
            if (proc.stdout && !isQuiet) {
                const output = await new Response(proc.stdout).text();
                //const stdoutString = proc.stdout;
                const lines = output.split(/\r?\n/);
                lines.forEach((line) => {
                    if (line.trim()) {
                        colorLog("GREY", line);
                    }
                });
            }
        },
    });
}