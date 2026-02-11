const isDev = process.env.NODE_ENV !== 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

const levels: Record<string, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

const currentLevel = levels[LOG_LEVEL] ?? 2;

function shouldLog(level: string): boolean {
  return (levels[level] ?? 2) >= currentLevel;
}

function formatMessage(level: string, msg: string, ...args: any[]): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] ${level.toUpperCase()}:`;
  
  if (args.length > 0 && args[0] instanceof Error) {
    return `${prefix} ${msg}\n${args[0].stack || args[0].message}`;
  }
  
  if (args.length > 0) {
    return `${prefix} ${msg} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`;
  }
  
  return `${prefix} ${msg}`;
}

export const logger = {
  trace: (msg: string, ...args: any[]) => {
    if (shouldLog('trace')) console.debug(formatMessage('trace', msg, ...args));
  },
  debug: (msg: string, ...args: any[]) => {
    if (shouldLog('debug')) console.debug(formatMessage('debug', msg, ...args));
  },
  info: (msg: string, ...args: any[]) => {
    if (shouldLog('info')) console.info(formatMessage('info', msg, ...args));
  },
  warn: (msg: string, ...args: any[]) => {
    if (shouldLog('warn')) console.warn(formatMessage('warn', msg, ...args));
  },
  error: (msg: unknown, ...args: any[]) => {
    if (shouldLog('error')) {
      if (msg instanceof Error) {
        console.error(formatMessage('error', msg.message, msg, ...args));
      } else if (typeof msg === 'string') {
        console.error(formatMessage('error', msg, ...args));
      } else {
        console.error(formatMessage('error', String(msg), ...args));
      }
    }
  },
  fatal: (msg: string, ...args: any[]) => {
    console.error(formatMessage('fatal', msg, ...args));
    process.exit(1);
  },
};

export default logger;
