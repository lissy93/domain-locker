// src/utils/logger.ts

type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug' | 'misc';

const COLORS: Record<LogLevel, string> = {
  info: '🔵',
  success: '🟢',
  warn: '🟡',
  error: '🔴',
  debug: '🟣',
  misc: '⚪',
};

const DL_DISABLE_LOGGING = process.env['DL_DISABLE_LOGGING'] === 'true';
const DL_DEBUG = process.env['DL_DEBUG'] === 'true';
const CENTRAL_LOG_URL = process.env['DL_CENTRAL_LOG_URL'];

// Loggers are long-lived, so the in-memory buffer must not grow without bound
const MAX_BUFFERED_LOGS = 500;

class Logger {
  private prefix: string;
  private logs: { level: LogLevel; message: string; timestamp: string }[] = [];

  constructor(prefix = '') {
    this.prefix = prefix ? `[${prefix}]` : '';
  }

  private shouldLog(level: LogLevel): boolean {
    if (DL_DISABLE_LOGGING) return false;
    if (level === 'debug' && !DL_DEBUG) return false;
    return true;
  }

  private write(level: LogLevel, msg: string) {
    const timestamp = new Date().toISOString();
    const line = `${COLORS[level]} ${this.prefix} ${msg}`;
    this.logs.push({ level, message: msg, timestamp });
    if (this.logs.length > MAX_BUFFERED_LOGS) {
      this.logs.splice(0, this.logs.length - MAX_BUFFERED_LOGS);
    }

    if (!this.shouldLog(level)) return;

    try {
      switch (level) {
        case 'error':
          console.error(line);
          break;
        case 'warn':
          console.warn(line);
          break;
        default:
          console.log(line);
      }
    } catch (_) {
      // Something has gone terribly wrong, even the console is broken!
      // This should never happen, but if it does, there's not much we can do.
    }
  }

  info(msg: string) {
    this.write('info', msg);
  }

  success(msg: string) {
    this.write('success', msg);
  }

  warn(msg: string) {
    this.write('warn', msg);
  }

  error(msg: string) {
    this.write('error', msg);
  }

  debug(msg: string) {
    this.write('debug', msg);
  }

  misc(msg: string) {
    this.write('misc', msg);
  }

  getLogs() {
    return this.logs;
  }

  async flushToRemote() {
    if (!CENTRAL_LOG_URL || this.logs.length === 0) return;
    try {
      await fetch(CENTRAL_LOG_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          prefix: this.prefix,
          logs: this.logs,
        }),
      });
    } catch (err) {
      this.warn('Flush to remote failed: ' + (err as Error)?.message);
    }
  }
}

export default Logger;
