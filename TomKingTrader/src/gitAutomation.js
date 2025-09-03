/**
 * GIT AUTOMATION SYSTEM
 * Automated hourly git commits for Tom King Trading Framework
 * Ensures continuous backup and change tracking for production trading system
 */

const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { getLogger } = require('./logger');

const logger = getLogger();

class GitAutomationManager {
    constructor(options = {}) {
        this.repoPath = options.repoPath || path.resolve(__dirname, '../..');
        this.enabled = options.enabled !== false; // Default to enabled
        this.commitInterval = options.commitInterval || 60 * 60 * 1000; // 1 hour default
        this.maxCommitsPerDay = options.maxCommitsPerDay || 24;
        this.branchName = options.branchName || 'master';
        
        // Commit message templates based on file changes
        this.commitTemplates = {
            strategies: 'feat: Update trading strategies and position management',
            riskManager: 'risk: Update risk management and correlation limits', 
            api: 'api: Update TastyTrade API integration and data connections',
            config: 'config: Update system configuration and parameters',
            protection: 'protect: Update Fed/earnings/circuit breaker protection systems',
            performance: 'perf: Update performance tracking and metrics',
            data: 'data: Update market data collection and processing',
            testing: 'test: Update testing framework and validation',
            default: 'chore: Automated system state backup'
        };
        
        // Critical files that should trigger immediate commits
        this.criticalFiles = [
            'src/riskManager.js',
            'src/emergencyProtocol.js',
            'src/fedAnnouncementProtection.js',
            'src/earningsCalendar.js',
            'credentials.config.js',
            'src/config.js'
        ];
        
        this.intervalId = null;
        this.lastCommitTime = null;
        this.commitCount = 0;
        this.dailyCommitCount = 0;
        this.lastResetDate = new Date().toDateString();
        
        logger.info('GIT', 'Git Automation Manager initialized', {
            repoPath: this.repoPath,
            enabled: this.enabled,
            intervalMinutes: this.commitInterval / 60000
        });
    }

    /**
     * Start automated git commits
     */
    start() {
        if (!this.enabled) {
            logger.warn('GIT', 'Git automation is disabled');
            return false;
        }

        if (this.intervalId) {
            logger.warn('GIT', 'Git automation already running');
            return false;
        }

        // Initial check
        this.performAutomatedCommit();
        
        // Set up hourly interval
        this.intervalId = setInterval(() => {
            this.performAutomatedCommit();
        }, this.commitInterval);
        
        logger.info('GIT', 'Git automation started', {
            interval: `${this.commitInterval / 60000} minutes`,
            nextCommit: new Date(Date.now() + this.commitInterval).toISOString()
        });
        
        return true;
    }

    /**
     * Stop automated git commits
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger.info('GIT', 'Git automation stopped');
            return true;
        }
        
        logger.warn('GIT', 'Git automation was not running');
        return false;
    }

    /**
     * Perform automated commit with intelligent message generation
     */
    async performAutomatedCommit() {
        try {
            // Reset daily counter if new day
            const today = new Date().toDateString();
            if (today !== this.lastResetDate) {
                this.dailyCommitCount = 0;
                this.lastResetDate = today;
                logger.info('GIT', 'Reset daily commit counter for new day');
            }

            // Check daily limit
            if (this.dailyCommitCount >= this.maxCommitsPerDay) {
                logger.warn('GIT', `Daily commit limit reached (${this.maxCommitsPerDay})`);
                return false;
            }

            // Check for changes
            const hasChanges = await this.checkForChanges();
            if (!hasChanges) {
                logger.debug('GIT', 'No changes to commit');
                return false;
            }

            // Get change analysis
            const changeAnalysis = await this.analyzeChanges();
            
            // Check if critical files changed (immediate commit)
            const criticalChanges = this.checkCriticalChanges(changeAnalysis.changedFiles);
            if (criticalChanges.length > 0) {
                logger.warn('GIT', 'Critical files changed - immediate commit triggered', {
                    files: criticalChanges
                });
            }

            // Generate intelligent commit message
            const commitMessage = this.generateCommitMessage(changeAnalysis);
            
            // Perform the commit
            const success = await this.executeCommit(commitMessage, changeAnalysis);
            
            if (success) {
                this.lastCommitTime = new Date();
                this.commitCount++;
                this.dailyCommitCount++;
                
                logger.info('GIT', 'Automated commit successful', {
                    message: commitMessage.split('\n')[0], // First line only
                    filesChanged: changeAnalysis.changedFiles.length,
                    totalCommits: this.commitCount,
                    dailyCommits: this.dailyCommitCount
                });
            }
            
            return success;
            
        } catch (error) {
            logger.error('GIT', 'Automated commit failed', error);
            return false;
        }
    }

    /**
     * Check if there are uncommitted changes
     */
    async checkForChanges() {
        return new Promise((resolve) => {
            exec('git status --porcelain', { cwd: this.repoPath }, (error, stdout) => {
                if (error) {
                    logger.error('GIT', 'Failed to check git status', error);
                    resolve(false);
                    return;
                }
                
                const hasChanges = stdout.trim().length > 0;
                resolve(hasChanges);
            });
        });
    }

    /**
     * Analyze what files have changed and categorize them
     */
    async analyzeChanges() {
        return new Promise((resolve) => {
            exec('git status --porcelain', { cwd: this.repoPath }, (error, stdout) => {
                if (error) {
                    logger.error('GIT', 'Failed to analyze changes', error);
                    resolve({ changedFiles: [], categories: {}, summary: 'Unknown changes' });
                    return;
                }
                
                const lines = stdout.trim().split('\n').filter(line => line.length > 0);
                const changedFiles = lines.map(line => line.substring(3)); // Remove status prefix
                
                const categories = this.categorizeChanges(changedFiles);
                const summary = this.generateChangeSummary(categories);
                
                resolve({
                    changedFiles,
                    categories,
                    summary,
                    lineCount: lines.length
                });
            });
        });
    }

    /**
     * Categorize changed files by type
     */
    categorizeChanges(changedFiles) {
        const categories = {
            strategies: [],
            riskManager: [],
            api: [],
            config: [],
            protection: [],
            performance: [],
            data: [],
            testing: [],
            documentation: [],
            other: []
        };

        changedFiles.forEach(file => {
            const filename = path.basename(file).toLowerCase();
            const filepath = file.toLowerCase();
            
            if (filename.includes('strateg') || filename.includes('position')) {
                categories.strategies.push(file);
            } else if (filename.includes('risk') || filename.includes('correlation')) {
                categories.riskManager.push(file);
            } else if (filename.includes('api') || filename.includes('tastytrade')) {
                categories.api.push(file);
            } else if (filename.includes('config') || filename.includes('credential')) {
                categories.config.push(file);
            } else if (filename.includes('fed') || filename.includes('earnings') || 
                      filename.includes('emergency') || filename.includes('protection')) {
                categories.protection.push(file);
            } else if (filename.includes('performance') || filename.includes('metric')) {
                categories.performance.push(file);
            } else if (filename.includes('data') || filename.includes('market')) {
                categories.data.push(file);
            } else if (filename.includes('test') || filename.includes('backtest')) {
                categories.testing.push(file);
            } else if (filename.includes('.md') || filename.includes('readme')) {
                categories.documentation.push(file);
            } else {
                categories.other.push(file);
            }
        });

        return categories;
    }

    /**
     * Generate summary of changes
     */
    generateChangeSummary(categories) {
        const summaryParts = [];
        
        Object.entries(categories).forEach(([category, files]) => {
            if (files.length > 0) {
                summaryParts.push(`${files.length} ${category} file${files.length > 1 ? 's' : ''}`);
            }
        });
        
        return summaryParts.join(', ') || 'miscellaneous changes';
    }

    /**
     * Check if any critical files have changed
     */
    checkCriticalChanges(changedFiles) {
        return changedFiles.filter(file => 
            this.criticalFiles.some(criticalFile => 
                file.includes(criticalFile)
            )
        );
    }

    /**
     * Generate intelligent commit message based on changes
     */
    generateCommitMessage(changeAnalysis) {
        const { categories, summary, changedFiles } = changeAnalysis;
        
        // Determine primary category
        let primaryCategory = 'default';
        let maxCount = 0;
        
        Object.entries(categories).forEach(([category, files]) => {
            if (files.length > maxCount) {
                maxCount = files.length;
                primaryCategory = category;
            }
        });

        // Get template message
        let commitType = this.commitTemplates[primaryCategory] || this.commitTemplates.default;
        
        // Add timestamp for automated commits
        const timestamp = new Date().toISOString().substring(0, 16).replace('T', ' ');
        
        // Build full commit message
        const commitMessage = `${commitType}

Automated backup - ${timestamp}
Changes: ${summary}
Files modified: ${changedFiles.length}

Modified files:
${changedFiles.slice(0, 10).map(file => `• ${file}`).join('\n')}${changedFiles.length > 10 ? `\n• ... and ${changedFiles.length - 10} more` : ''}

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>`;

        return commitMessage;
    }

    /**
     * Execute the git commit
     */
    async executeCommit(commitMessage, changeAnalysis) {
        return new Promise((resolve) => {
            // Stage all changes
            exec('git add -A', { cwd: this.repoPath }, (addError) => {
                if (addError) {
                    logger.error('GIT', 'Failed to stage changes', addError);
                    resolve(false);
                    return;
                }

                // Create commit with HEREDOC format
                const commitCommand = `git commit -m "$(cat <<'EOF'\n${commitMessage}\nEOF\n)"`;
                
                exec(commitCommand, { cwd: this.repoPath }, (commitError, stdout, stderr) => {
                    if (commitError) {
                        logger.error('GIT', 'Failed to create commit', { 
                            error: commitError.message,
                            stderr: stderr 
                        });
                        resolve(false);
                        return;
                    }
                    
                    logger.debug('GIT', 'Commit output', { stdout, stderr });
                    resolve(true);
                });
            });
        });
    }

    /**
     * Get automation status
     */
    getStatus() {
        return {
            enabled: this.enabled,
            running: !!this.intervalId,
            lastCommitTime: this.lastCommitTime,
            totalCommits: this.commitCount,
            dailyCommits: this.dailyCommitCount,
            maxDailyCommits: this.maxCommitsPerDay,
            intervalMinutes: this.commitInterval / 60000,
            nextCommitTime: this.intervalId ? new Date(Date.now() + this.commitInterval) : null,
            repoPath: this.repoPath
        };
    }

    /**
     * Force an immediate commit (manual trigger)
     */
    async forceCommit(reason = 'Manual trigger') {
        logger.info('GIT', 'Forcing immediate commit', { reason });
        
        // Temporarily bypass daily limit for manual commits
        const originalLimit = this.maxCommitsPerDay;
        this.maxCommitsPerDay += 1;
        
        const result = await this.performAutomatedCommit();
        
        // Restore original limit
        this.maxCommitsPerDay = originalLimit;
        
        return result;
    }

    /**
     * Update automation settings
     */
    updateSettings(newSettings) {
        const oldSettings = {
            enabled: this.enabled,
            interval: this.commitInterval,
            maxDaily: this.maxCommitsPerDay
        };

        if (newSettings.enabled !== undefined) {
            this.enabled = newSettings.enabled;
        }
        
        if (newSettings.commitInterval !== undefined) {
            this.commitInterval = newSettings.commitInterval;
            
            // Restart if running
            if (this.intervalId) {
                this.stop();
                this.start();
            }
        }
        
        if (newSettings.maxCommitsPerDay !== undefined) {
            this.maxCommitsPerDay = newSettings.maxCommitsPerDay;
        }

        logger.info('GIT', 'Automation settings updated', {
            old: oldSettings,
            new: {
                enabled: this.enabled,
                interval: this.commitInterval,
                maxDaily: this.maxCommitsPerDay
            }
        });
    }
}

/**
 * Global instance for easy access
 */
let globalAutomation = null;

/**
 * Initialize git automation
 */
function initializeGitAutomation(options = {}) {
    if (globalAutomation) {
        logger.warn('GIT', 'Git automation already initialized');
        return globalAutomation;
    }
    
    globalAutomation = new GitAutomationManager(options);
    return globalAutomation;
}

/**
 * Get the global automation instance
 */
function getGitAutomation() {
    if (!globalAutomation) {
        logger.warn('GIT', 'Git automation not initialized, creating default instance');
        globalAutomation = new GitAutomationManager();
    }
    
    return globalAutomation;
}

/**
 * Start automation with default settings
 */
function startGitAutomation(options = {}) {
    const automation = initializeGitAutomation(options);
    return automation.start();
}

/**
 * Stop automation
 */
function stopGitAutomation() {
    if (globalAutomation) {
        return globalAutomation.stop();
    }
    
    logger.warn('GIT', 'No automation instance to stop');
    return false;
}

// Export for use in other modules
module.exports = {
    GitAutomationManager,
    initializeGitAutomation,
    getGitAutomation,
    startGitAutomation,
    stopGitAutomation
};

// Auto-start if this file is run directly
if (require.main === module) {
    logger.info('GIT', 'Starting git automation from command line');
    
    const automation = startGitAutomation({
        enabled: true,
        commitInterval: 60 * 60 * 1000, // 1 hour
        maxCommitsPerDay: 24
    });
    
    if (automation) {
        logger.info('GIT', 'Git automation started successfully');
        
        // Graceful shutdown
        process.on('SIGINT', () => {
            logger.info('GIT', 'Received SIGINT, stopping git automation');
            stopGitAutomation();
            process.exit(0);
        });
        
        process.on('SIGTERM', () => {
            logger.info('GIT', 'Received SIGTERM, stopping git automation');
            stopGitAutomation();
            process.exit(0);
        });
    } else {
        logger.error('GIT', 'Failed to start git automation');
        process.exit(1);
    }
}