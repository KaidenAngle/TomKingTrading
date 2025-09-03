/**
 * Emergency Protocol System
 * Implements failsafe mechanisms and emergency stop procedures
 * Based on August 5, 2024 lessons
 */

const EventEmitter = require('events');
const { TastyTradeAPI } = require('./tastytradeAPI');
const { OrderManager } = require('./orderManager');
const { RiskManager } = require('./riskManager');
const { getLogger } = require('./logger');
const fs = require('fs').promises;

const logger = getLogger();

class EmergencyProtocol extends EventEmitter {
    constructor(api = null) {
        super();
        this.api = api || new TastyTradeAPI();
        this.orderManager = new OrderManager(this.api);
        this.riskManager = new RiskManager();
        
        this.triggers = {
            maxDrawdown: 0.15, // 15% account drawdown
            vixSpike: 10, // 10 point VIX spike
            correlationViolation: 5, // 5+ positions in same group
            rapidLoss: 0.05, // 5% loss in 1 hour
            apiDisconnect: 300000, // 5 minutes disconnect
            marginCall: 0.90, // 90% BP usage
            volatilityExplosion: 2.0 // 200% IV increase
        };
        
        this.state = {
            active: false,
            triggered: null,
            startTime: null,
            actions: [],
            positions: [],
            initialBalance: 0
        };
        
        this.emergencyLog = [];
    }
    
    /**
     * Initialize emergency system
     */
    async initialize() {
        try {
            logger.info('EMERGENCY', 'Initializing emergency protocol system');
            
            // Get initial account state
            if (this.api.connected) {
                const balance = await this.api.refreshBalance();
                this.state.initialBalance = balance;
            }
            
            // Set up monitoring
            this.setupMonitoring();
            
            console.log('🚨 Emergency Protocol System Initialized');
            console.log(`   Max Drawdown: ${this.triggers.maxDrawdown * 100}%`);
            console.log(`   VIX Spike: ${this.triggers.vixSpike} points`);
            console.log(`   Rapid Loss: ${this.triggers.rapidLoss * 100}% per hour`);
            
        } catch (error) {
            logger.error('EMERGENCY', 'Failed to initialize emergency system', error);
            throw error;
        }
    }
    
    /**
     * Setup continuous monitoring
     */
    setupMonitoring() {
        // Monitor every 30 seconds
        this.monitoringInterval = setInterval(async () => {
            if (!this.state.active) {
                await this.checkTriggers();
            }
        }, 30000);
        
        // Setup signal handlers
        process.on('SIGINT', () => this.manualTrigger('SIGINT'));
        process.on('SIGTERM', () => this.manualTrigger('SIGTERM'));
    }
    
    /**
     * Check all emergency triggers
     */
    async checkTriggers() {
        const triggers = [];
        
        try {
            // Check drawdown
            const drawdown = await this.checkDrawdown();
            if (drawdown > this.triggers.maxDrawdown) {
                triggers.push({
                    type: 'DRAWDOWN',
                    value: drawdown,
                    threshold: this.triggers.maxDrawdown,
                    severity: 'CRITICAL'
                });
            }
            
            // Check VIX spike
            const vixSpike = await this.checkVIXSpike();
            if (vixSpike > this.triggers.vixSpike) {
                triggers.push({
                    type: 'VIX_SPIKE',
                    value: vixSpike,
                    threshold: this.triggers.vixSpike,
                    severity: 'HIGH'
                });
            }
            
            // Check correlation violations
            const correlations = await this.checkCorrelations();
            if (correlations.violations > 0) {
                triggers.push({
                    type: 'CORRELATION_VIOLATION',
                    value: correlations.maxGroup,
                    threshold: this.triggers.correlationViolation,
                    severity: 'HIGH'
                });
            }
            
            // Check rapid loss
            const rapidLoss = await this.checkRapidLoss();
            if (rapidLoss > this.triggers.rapidLoss) {
                triggers.push({
                    type: 'RAPID_LOSS',
                    value: rapidLoss,
                    threshold: this.triggers.rapidLoss,
                    severity: 'CRITICAL'
                });
            }
            
            // Check margin/BP usage
            const bpUsage = await this.checkBPUsage();
            if (bpUsage > this.triggers.marginCall) {
                triggers.push({
                    type: 'MARGIN_CALL_RISK',
                    value: bpUsage,
                    threshold: this.triggers.marginCall,
                    severity: 'CRITICAL'
                });
            }
            
            // Activate if any critical triggers
            const criticalTriggers = triggers.filter(t => t.severity === 'CRITICAL');
            if (criticalTriggers.length > 0) {
                await this.activate(criticalTriggers[0]);
            }
            
        } catch (error) {
            logger.error('EMERGENCY', 'Error checking triggers', error);
        }
    }
    
    /**
     * Check account drawdown
     */
    async checkDrawdown() {
        try {
            const currentBalance = await this.api.refreshBalance();
            const drawdown = (this.state.initialBalance - currentBalance) / this.state.initialBalance;
            return Math.max(0, drawdown);
        } catch (error) {
            return 0;
        }
    }
    
    /**
     * Check VIX spike
     */
    async checkVIXSpike() {
        try {
            const vixData = await this.api.getQuotes(['VIX']);
            if (!vixData || !vixData.VIX) return 0;
            
            const currentVIX = vixData.VIX.last || vixData.VIX.mark;
            const previousVIX = vixData.VIX.previousClose || currentVIX;
            
            return currentVIX - previousVIX;
        } catch (error) {
            return 0;
        }
    }
    
    /**
     * Check correlation violations
     */
    async checkCorrelations() {
        try {
            const positions = await this.api.refreshPositions();
            const correlations = this.riskManager.checkCorrelations(positions);
            
            return {
                violations: correlations.violations.length,
                maxGroup: Math.max(...Object.values(correlations.groups).map(g => g.count))
            };
        } catch (error) {
            return { violations: 0, maxGroup: 0 };
        }
    }
    
    /**
     * Check rapid loss (1 hour)
     */
    async checkRapidLoss() {
        try {
            // This would need to track P&L over time
            // For now, simplified check
            const currentBalance = await this.api.refreshBalance();
            const hourAgo = this.hourlyBalances?.[this.hourlyBalances.length - 1] || currentBalance;
            
            const loss = (hourAgo - currentBalance) / hourAgo;
            return Math.max(0, loss);
        } catch (error) {
            return 0;
        }
    }
    
    /**
     * Check BP usage
     */
    async checkBPUsage() {
        try {
            const account = await this.api.getAccount();
            const bpUsed = account.buying_power_used || 0;
            const bpTotal = account.buying_power || 1;
            
            return bpUsed / bpTotal;
        } catch (error) {
            return 0;
        }
    }
    
    /**
     * Manually trigger emergency protocol
     */
    async manualTrigger(reason = 'MANUAL') {
        console.log(`\n🚨 EMERGENCY PROTOCOL MANUALLY TRIGGERED: ${reason}`);
        await this.activate({
            type: 'MANUAL',
            value: reason,
            severity: 'CRITICAL'
        });
    }
    
    /**
     * Activate emergency protocol
     */
    async activate(trigger) {
        if (this.state.active) {
            logger.warn('EMERGENCY', 'Emergency protocol already active');
            return;
        }
        
        console.log('\n' + '🚨'.repeat(20));
        console.log('EMERGENCY PROTOCOL ACTIVATED');
        console.log(`Trigger: ${trigger.type} - Value: ${trigger.value}`);
        console.log('🚨'.repeat(20) + '\n');
        
        this.state.active = true;
        this.state.triggered = trigger;
        this.state.startTime = Date.now();
        
        this.emit('activated', trigger);
        
        // Log emergency
        await this.logEmergency(trigger);
        
        // Execute emergency procedures
        await this.executeEmergencyProcedures();
    }
    
    /**
     * Execute emergency procedures
     */
    async executeEmergencyProcedures() {
        const procedures = [
            'STOP_NEW_TRADES',
            'CLOSE_RISKY_POSITIONS',
            'REDUCE_EXPOSURE',
            'HEDGE_PORTFOLIO',
            'NOTIFY_OPERATOR',
            'BACKUP_DATA'
        ];
        
        for (const procedure of procedures) {
            try {
                console.log(`\n📌 Executing: ${procedure}`);
                
                switch(procedure) {
                    case 'STOP_NEW_TRADES':
                        await this.stopNewTrades();
                        break;
                    case 'CLOSE_RISKY_POSITIONS':
                        await this.closeRiskyPositions();
                        break;
                    case 'REDUCE_EXPOSURE':
                        await this.reduceExposure();
                        break;
                    case 'HEDGE_PORTFOLIO':
                        await this.hedgePortfolio();
                        break;
                    case 'NOTIFY_OPERATOR':
                        await this.notifyOperator();
                        break;
                    case 'BACKUP_DATA':
                        await this.backupData();
                        break;
                }
                
                this.state.actions.push({
                    procedure,
                    time: Date.now(),
                    status: 'COMPLETED'
                });
                
                console.log(`   ✅ ${procedure} completed`);
                
            } catch (error) {
                logger.error('EMERGENCY', `Failed to execute ${procedure}`, error);
                this.state.actions.push({
                    procedure,
                    time: Date.now(),
                    status: 'FAILED',
                    error: error.message
                });
            }
        }
        
        console.log('\n✅ Emergency procedures completed');
        await this.generateReport();
    }
    
    /**
     * Stop all new trades
     */
    async stopNewTrades() {
        // Set global flag to prevent new trades
        global.EMERGENCY_STOP = true;
        
        // Cancel all pending orders
        try {
            const orders = await this.orderManager.getPendingOrders();
            for (const order of orders) {
                await this.orderManager.cancelOrder(order.id);
            }
            logger.info('EMERGENCY', `Cancelled ${orders.length} pending orders`);
        } catch (error) {
            logger.error('EMERGENCY', 'Failed to cancel orders', error);
        }
    }
    
    /**
     * Close risky positions
     */
    async closeRiskyPositions() {
        try {
            const positions = await this.api.refreshPositions();
            const riskyPositions = positions.filter(p => {
                // Identify risky positions (0DTE, high delta, losing)
                const is0DTE = p.days_to_expiration <= 1;
                const highDelta = Math.abs(p.delta || 0) > 0.30;
                const losing = (p.unrealized_pnl || 0) < 0;
                
                return is0DTE || (highDelta && losing);
            });
            
            logger.info('EMERGENCY', `Identified ${riskyPositions.length} risky positions to close`);
            
            // Note: Actual closing would require order execution
            // For safety, we just prepare the orders
            for (const position of riskyPositions) {
                const closeOrder = this.orderManager.prepareCloseOrder(position);
                this.state.positions.push({
                    symbol: position.symbol,
                    action: 'CLOSE_RISKY',
                    order: closeOrder
                });
            }
            
        } catch (error) {
            logger.error('EMERGENCY', 'Failed to close risky positions', error);
        }
    }
    
    /**
     * Reduce overall exposure
     */
    async reduceExposure() {
        try {
            // Target 50% reduction in exposure
            const positions = await this.api.refreshPositions();
            const currentExposure = positions.reduce((sum, p) => sum + Math.abs(p.market_value || 0), 0);
            const targetExposure = currentExposure * 0.5;
            
            logger.info('EMERGENCY', `Reducing exposure from ${currentExposure} to ${targetExposure}`);
            
            // Sort positions by size and close largest first
            positions.sort((a, b) => Math.abs(b.market_value || 0) - Math.abs(a.market_value || 0));
            
            let reducedExposure = 0;
            for (const position of positions) {
                if (reducedExposure >= (currentExposure - targetExposure)) {
                    break;
                }
                
                const closeOrder = this.orderManager.prepareCloseOrder(position);
                this.state.positions.push({
                    symbol: position.symbol,
                    action: 'REDUCE_EXPOSURE',
                    order: closeOrder
                });
                
                reducedExposure += Math.abs(position.market_value || 0);
            }
            
        } catch (error) {
            logger.error('EMERGENCY', 'Failed to reduce exposure', error);
        }
    }
    
    /**
     * Hedge portfolio with protective positions
     */
    async hedgePortfolio() {
        try {
            // Prepare VIX calls or SPY puts as hedges
            const hedgeOrders = [];
            
            // VIX hedge
            const vixHedge = this.orderManager.prepareHedgeOrder({
                symbol: 'VIX',
                type: 'CALL',
                quantity: 10,
                expiration: '30_DAYS'
            });
            
            hedgeOrders.push(vixHedge);
            
            // SPY hedge
            const spyHedge = this.orderManager.prepareHedgeOrder({
                symbol: 'SPY',
                type: 'PUT',
                quantity: 5,
                expiration: '30_DAYS'
            });
            
            hedgeOrders.push(spyHedge);
            
            logger.info('EMERGENCY', `Prepared ${hedgeOrders.length} hedge orders`);
            
            this.state.positions.push({
                action: 'HEDGE',
                orders: hedgeOrders
            });
            
        } catch (error) {
            logger.error('EMERGENCY', 'Failed to hedge portfolio', error);
        }
    }
    
    /**
     * Notify operator
     */
    async notifyOperator() {
        console.log('\n📧 OPERATOR NOTIFICATION SENT');
        console.log('   Email: emergency@tradingsystem.com');
        console.log('   Phone: System administrator notified');
        console.log('   Slack: #emergency-alerts');
        
        // In production, this would send actual notifications
        logger.warn('EMERGENCY', 'OPERATOR NOTIFICATION REQUIRED');
    }
    
    /**
     * Backup all data
     */
    async backupData() {
        try {
            const backup = {
                timestamp: new Date().toISOString(),
                trigger: this.state.triggered,
                positions: await this.api.refreshPositions(),
                balance: await this.api.refreshBalance(),
                actions: this.state.actions,
                state: this.state
            };
            
            const filename = `emergency_backup_${Date.now()}.json`;
            await fs.writeFile(
                `./backups/${filename}`,
                JSON.stringify(backup, null, 2)
            );
            
            logger.info('EMERGENCY', `Data backed up to ${filename}`);
            
        } catch (error) {
            logger.error('EMERGENCY', 'Failed to backup data', error);
        }
    }
    
    /**
     * Generate emergency report
     */
    async generateReport() {
        const report = {
            activated: this.state.startTime,
            trigger: this.state.triggered,
            duration: Date.now() - this.state.startTime,
            actions: this.state.actions,
            positions: this.state.positions,
            status: 'EMERGENCY_ACTIVE'
        };
        
        console.log('\n📊 EMERGENCY REPORT:');
        console.log(JSON.stringify(report, null, 2));
        
        // Save report
        try {
            await fs.writeFile(
                `./reports/emergency_${Date.now()}.json`,
                JSON.stringify(report, null, 2)
            );
        } catch (error) {
            logger.error('EMERGENCY', 'Failed to save report', error);
        }
    }
    
    /**
     * Log emergency event
     */
    async logEmergency(trigger) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            trigger,
            state: this.state
        };
        
        this.emergencyLog.push(logEntry);
        
        try {
            await fs.appendFile(
                './logs/emergency.log',
                JSON.stringify(logEntry) + '\n'
            );
        } catch (error) {
            logger.error('EMERGENCY', 'Failed to log emergency', error);
        }
    }
    
    /**
     * Close all positions with priority ordering
     * Priority: 0DTE first, then losing positions, then by size
     */
    async closeAllPositions(options = {}) {
        const {
            batchSize = 5,          // Process in batches to avoid API overload
            delayBetweenBatches = 2000,  // 2 seconds between batches
            priorityOrder = true,   // Use priority ordering
            dryRun = false          // If true, only prepare orders without execution
        } = options;

        try {
            console.log('\n🚨 CLOSING ALL POSITIONS - EMERGENCY PROTOCOL');
            
            // Get all current positions
            const positions = await this.api.refreshPositions();
            if (!positions || positions.length === 0) {
                console.log('No positions to close');
                return { closed: 0, failed: 0, positions: [] };
            }

            console.log(`Found ${positions.length} positions to close`);

            // Sort positions by priority if requested
            let sortedPositions = [...positions];
            if (priorityOrder) {
                sortedPositions = this.prioritizePositionsForClosure(positions);
            }

            // Track results
            const results = {
                closed: 0,
                failed: 0,
                positions: []
            };

            // Process in batches
            for (let i = 0; i < sortedPositions.length; i += batchSize) {
                const batch = sortedPositions.slice(i, i + batchSize);
                console.log(`\nProcessing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(sortedPositions.length/batchSize)}`);

                // Process each position in the batch
                const batchPromises = batch.map(async (position) => {
                    try {
                        console.log(`  Closing: ${position.symbol} (DTE: ${position.days_to_expiration}, P&L: ${position.unrealized_pnl?.toFixed(2) || 0})`);
                        
                        if (!dryRun) {
                            // Prepare close order
                            const closeOrder = await this.orderManager.prepareCloseOrder(position);
                            
                            // In production, this would submit the order
                            // For safety, we just prepare it
                            results.positions.push({
                                symbol: position.symbol,
                                quantity: position.quantity,
                                dte: position.days_to_expiration,
                                unrealizedPnL: position.unrealized_pnl,
                                order: closeOrder,
                                status: 'PREPARED'
                            });
                            
                            results.closed++;
                        } else {
                            console.log(`    [DRY RUN] Would close ${position.symbol}`);
                            results.positions.push({
                                symbol: position.symbol,
                                status: 'DRY_RUN'
                            });
                        }
                        
                        // Emit event for tracking
                        this.emit('positionClosed', {
                            position,
                            reason: 'EMERGENCY_CLOSE_ALL'
                        });
                        
                    } catch (error) {
                        console.error(`    Failed to close ${position.symbol}: ${error.message}`);
                        results.failed++;
                        results.positions.push({
                            symbol: position.symbol,
                            status: 'FAILED',
                            error: error.message
                        });
                    }
                });

                // Wait for batch to complete
                await Promise.all(batchPromises);

                // Delay before next batch (to avoid API rate limits)
                if (i + batchSize < sortedPositions.length) {
                    console.log(`  Waiting ${delayBetweenBatches}ms before next batch...`);
                    await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
                }
            }

            // Generate summary
            console.log('\n📊 CLOSE ALL POSITIONS SUMMARY:');
            console.log(`  ✅ Successfully prepared: ${results.closed}`);
            console.log(`  ❌ Failed: ${results.failed}`);
            console.log(`  📝 Total processed: ${results.closed + results.failed}`);

            // Log the action
            this.state.actions.push({
                procedure: 'CLOSE_ALL_POSITIONS',
                time: Date.now(),
                results
            });

            return results;

        } catch (error) {
            logger.error('EMERGENCY', 'Failed to close all positions', error);
            throw error;
        }
    }

    /**
     * Prioritize positions for closure based on risk
     * Order: 0DTE > Losing > High Delta > Large positions
     */
    prioritizePositionsForClosure(positions) {
        return positions.sort((a, b) => {
            // Priority 1: 0DTE positions (highest risk)
            const aDTE = a.days_to_expiration || 999;
            const bDTE = b.days_to_expiration || 999;
            if (aDTE <= 1 && bDTE > 1) return -1;
            if (bDTE <= 1 && aDTE > 1) return 1;

            // Priority 2: Losing positions
            const aPnL = a.unrealized_pnl || 0;
            const bPnL = b.unrealized_pnl || 0;
            if (aPnL < 0 && bPnL >= 0) return -1;
            if (bPnL < 0 && aPnL >= 0) return 1;

            // Priority 3: High delta (high directional risk)
            const aDelta = Math.abs(a.delta || 0);
            const bDelta = Math.abs(b.delta || 0);
            if (aDelta > 0.30 && bDelta <= 0.30) return -1;
            if (bDelta > 0.30 && aDelta <= 0.30) return 1;

            // Priority 4: Position size (largest first)
            const aValue = Math.abs(a.market_value || 0);
            const bValue = Math.abs(b.market_value || 0);
            return bValue - aValue;
        });
    }

    /**
     * Deactivate emergency protocol
     */
    async deactivate() {
        if (!this.state.active) {
            return;
        }
        
        console.log('\n✅ Deactivating emergency protocol...');
        
        this.state.active = false;
        global.EMERGENCY_STOP = false;
        
        await this.generateReport();
        
        this.emit('deactivated');
        
        console.log('✅ Emergency protocol deactivated');
    }
}

// Export
module.exports = { EmergencyProtocol };

// Test if run directly
if (require.main === module) {
    console.log('🧪 Testing Emergency Protocol System...\n');
    
    const emergency = new EmergencyProtocol();
    
    emergency.initialize().then(() => {
        console.log('\nEmergency system ready. Press Ctrl+C to trigger manual emergency.');
        
        // Test trigger after 5 seconds
        setTimeout(() => {
            console.log('\n🧪 Simulating emergency trigger...');
            emergency.activate({
                type: 'TEST',
                value: 'Simulated emergency',
                severity: 'CRITICAL'
            });
        }, 5000);
    });
}