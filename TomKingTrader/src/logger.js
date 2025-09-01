/**
 * Enhanced Logging System for TomKingTrader
 * Provides comprehensive error tracking and debugging
 */

const fs = require('fs').promises;
const path = require('path');

class TomKingLogger {
    constructor(options = {}) {
        this.logLevel = options.logLevel || 'info';
        this.logToFile = options.logToFile !== false;
        this.logDir = options.logDir || path.join(__dirname, '..', 'logs');
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
        
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
            trace: 4
        };
        
        this.colors = {
            error: '\x1b[31m', // Red
            warn: '\x1b[33m',  // Yellow
            info: '\x1b[36m',  // Cyan
            debug: '\x1b[35m', // Magenta
            trace: '\x1b[90m', // Gray
            reset: '\x1b[0m'
        };
        
        this.initializeLogFile();
    }
    
    async initializeLogFile() {
        if (!this.logToFile) return;
        
        try {
            await fs.mkdir(this.logDir, { recursive: true });
            this.currentLogFile = path.join(this.logDir, `tomking-${new Date().toISOString().split('T')[0]}.log`);
        } catch (error) {
            console.error('Failed to initialize log file:', error);
            this.logToFile = false;
            this.currentLogFile = null;
        }
    }
    
    formatMessage(level, category, message, data) {
        const timestamp = new Date().toISOString();
        const color = this.colors[level] || this.colors.reset;
        
        let formattedMessage = `[${timestamp}] [${level.toUpperCase()}] [${category}]`;
        
        if (message) {
            formattedMessage += ` ${message}`;
        }
        
        if (data) {
            if (data instanceof Error) {
                formattedMessage += `\n  Error: ${data.message}`;
                if (data.stack && this.levels[level] <= this.levels.debug) {
                    formattedMessage += `\n  Stack: ${data.stack}`;
                }
            } else if (typeof data === 'object') {
                formattedMessage += `\n  Data: ${JSON.stringify(data, null, 2)}`;
            } else {
                formattedMessage += ` | ${data}`;
            }
        }
        
        return {
            console: `${color}${formattedMessage}${this.colors.reset}`,
            file: formattedMessage
        };
    }
    
    async writeToFile(message) {
        if (!this.logToFile || !this.currentLogFile) return;
        
        try {
            await fs.appendFile(this.currentLogFile, message + '\n');
            
            // Check file size and rotate if needed
            const stats = await fs.stat(this.currentLogFile);
            if (stats.size > this.maxFileSize) {
                await this.rotateLogFile();
            }
        } catch (error) {
            // Silently fail for file writing to avoid cluttering console
            this.logToFile = false;
        }
    }
    
    async rotateLogFile() {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const rotatedFile = path.join(this.logDir, `tomking-${timestamp}.log`);
        
        try {
            await fs.rename(this.currentLogFile, rotatedFile);
            await this.initializeLogFile();
        } catch (error) {
            console.error('Failed to rotate log file:', error);
        }
    }
    
    log(level, category, message, data) {
        if (this.levels[level] > this.levels[this.logLevel]) return;
        
        const formatted = this.formatMessage(level, category, message, data);
        
        // Console output
        console.log(formatted.console);
        
        // File output
        this.writeToFile(formatted.file);
    }
    
    // Convenience methods
    error(category, message, data) {
        this.log('error', category, message, data);
    }
    
    warn(category, message, data) {
        this.log('warn', category, message, data);
    }
    
    info(category, message, data) {
        this.log('info', category, message, data);
    }
    
    debug(category, message, data) {
        this.log('debug', category, message, data);
    }
    
    trace(category, message, data) {
        this.log('trace', category, message, data);
    }
    
    // Trading-specific logging methods
    logTrade(action, details) {
        this.info('TRADE', action, details);
    }
    
    logSignal(signal) {
        this.info('SIGNAL', `${signal.type} signal for ${signal.symbol}`, {
            strategy: signal.strategy,
            confidence: signal.confidence,
            entry: signal.entry,
            target: signal.target,
            stop: signal.stop
        });
    }
    
    logRisk(event, details) {
        this.warn('RISK', event, details);
    }
    
    logAnalysis(phase, result) {
        this.debug('ANALYSIS', phase, result);
    }
    
    logAPI(endpoint, method, status, data) {
        const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'debug';
        this.log(level, 'API', `${method} ${endpoint} - ${status}`, data);
    }
    
    logPerformance(operation, duration, details) {
        this.debug('PERFORMANCE', `${operation} took ${duration}ms`, details);
    }
    
    logPosition(action, position) {
        this.info('POSITION', action, {
            ticker: position.ticker,
            strategy: position.strategy,
            dte: position.dte,
            quantity: position.quantity,
            pl: position.pl
        });
    }
    
    logMarketData(ticker, data) {
        this.trace('MARKET', `Data update for ${ticker}`, {
            price: data.currentPrice,
            iv: data.iv,
            ivRank: data.ivRank,
            volume: data.volume
        });
    }
    
    logSystemEvent(event, details) {
        this.info('SYSTEM', event, details);
    }
    
    // Error boundary wrapper
    async safeExecute(operation, fn, ...args) {
        const startTime = Date.now();
        
        try {
            this.trace('EXECUTE', `Starting ${operation}`);
            const result = await fn(...args);
            const duration = Date.now() - startTime;
            this.debug('EXECUTE', `Completed ${operation}`, { duration });
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.error('EXECUTE', `Failed ${operation}`, {
                error: error.message,
                stack: error.stack,
                duration,
                args: args.length > 0 ? args : undefined
            });
            throw error;
        }
    }
    
    // Request/Response logging for API
    logRequest(req) {
        this.debug('REQUEST', `${req.method} ${req.url}`, {
            headers: req.headers,
            body: req.body,
            query: req.query,
            params: req.params
        });
    }
    
    logResponse(req, res, duration) {
        const level = res.statusCode >= 400 ? 'error' : res.statusCode >= 300 ? 'warn' : 'debug';
        this.log(level, 'RESPONSE', `${req.method} ${req.url} - ${res.statusCode}`, {
            duration: `${duration}ms`,
            headers: res.getHeaders()
        });
    }
    
    // Session summary
    async generateSessionSummary() {
        const summary = {
            timestamp: new Date().toISOString(),
            logLevel: this.logLevel,
            logFile: this.currentLogFile,
            stats: {
                errors: 0,
                warnings: 0,
                trades: 0,
                signals: 0,
                apiCalls: 0
            }
        };
        
        if (this.logToFile && this.currentLogFile) {
            try {
                const content = await fs.readFile(this.currentLogFile, 'utf-8');
                const lines = content.split('\n');
                
                summary.stats.errors = lines.filter(l => l.includes('[ERROR]')).length;
                summary.stats.warnings = lines.filter(l => l.includes('[WARN]')).length;
                summary.stats.trades = lines.filter(l => l.includes('[TRADE]')).length;
                summary.stats.signals = lines.filter(l => l.includes('[SIGNAL]')).length;
                summary.stats.apiCalls = lines.filter(l => l.includes('[API]')).length;
            } catch (error) {
                this.error('LOGGER', 'Failed to generate session summary', error);
            }
        }
        
        return summary;
    }
}

// Singleton instance
let loggerInstance = null;

function createLogger(options = {}) {
    if (!loggerInstance) {
        // Set production defaults
        const defaultOptions = {
            logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
            ...options
        };
        loggerInstance = new TomKingLogger(defaultOptions);
    }
    return loggerInstance;
}

function getLogger() {
    if (!loggerInstance) {
        // Set production defaults
        const defaultOptions = {
            logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
        };
        loggerInstance = new TomKingLogger(defaultOptions);
    }
    return loggerInstance;
}

module.exports = {
    TomKingLogger,
    createLogger,
    getLogger
};