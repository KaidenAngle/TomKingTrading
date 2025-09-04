const EventEmitter = require('events');
const TreasuryAuctionCalendar = require('../src/treasuryAuctionCalendar');
const AssignmentRiskMonitor = require('../src/assignmentRiskMonitor');
const OptionsPinningDetector = require('../src/optionsPinningDetector');
const FuturesRollCalendar = require('../src/futuresRollCalendar');
const MomentumSpikeProtection = require('../src/momentumSpikeProtection');
const FridayPsychologyProtection = require('../src/fridayPsychologyProtection');
const EconomicDataCalendar = require('../src/economicDataCalendar');
const OptionsFlowAnomalyDetector = require('../src/optionsFlowAnomalyDetector');
const MarketMicrostructure = require('../src/marketMicrostructureMonitor');

class UnifiedProtectionOrchestrator extends EventEmitter {
    constructor() {
        super();
        
        // Protection subsystems
        this.treasuryCalendar = new TreasuryAuctionCalendar();
        this.assignmentMonitor = new AssignmentRiskMonitor();
        this.pinningDetector = new OptionsPinningDetector();
        this.futuresRollCalendar = new FuturesRollCalendar();
        this.momentumProtection = new MomentumSpikeProtection();
        this.fridayProtection = new FridayPsychologyProtection();
        this.economicCalendar = new EconomicDataCalendar();
        this.flowAnomalyDetector = new OptionsFlowAnomalyDetector();
        this.microstructure = new MarketMicrostructure();
        
        // Unified protection state
        this.protectionState = {
            overallRiskLevel: 'NORMAL',
            activeProtections: new Map(),
            restrictions: new Set(),
            adjustmentFactors: {
                positionSize: 1.0,
                stopLoss: 1.0,
                profitTarget: 1.0,
                maxBPUsage: 1.0,
                entryThreshold: 1.0
            },
            alerts: [],
            lastUpdate: null
        };
        
        // Protection priority levels
        this.PRIORITY = {
            CRITICAL: 5,
            HIGH: 4,
            MEDIUM: 3,
            LOW: 2,
            INFO: 1
        };
        
        // Initialize subsystem listeners
        this.initializeListeners();
    }
    
    initializeListeners() {
        // Treasury auction events
        this.treasuryCalendar.on('auctionAlert', (alert) => {
            this.handleProtectionEvent('TREASURY', alert);
        });
        
        // Assignment risk events
        this.assignmentMonitor.on('assignmentWarning', (warning) => {
            this.handleProtectionEvent('ASSIGNMENT', warning);
        });
        
        // Options pinning events
        this.pinningDetector.on('pinAlert', (alert) => {
            this.handleProtectionEvent('PINNING', alert);
        });
        
        // Futures roll events
        this.futuresRollCalendar.on('rollAlert', (alert) => {
            this.handleProtectionEvent('FUTURES_ROLL', alert);
        });
        
        // Momentum spike events
        this.momentumProtection.on('spikeDetected', (spike) => {
            this.handleProtectionEvent('MOMENTUM_SPIKE', spike);
        });
        
        // Friday psychology events
        this.fridayProtection.on('fridayWarning', (warning) => {
            this.handleProtectionEvent('FRIDAY_PSYCHOLOGY', warning);
        });
        
        // Economic data events
        this.economicCalendar.on('economicAlert', (alert) => {
            this.handleProtectionEvent('ECONOMIC_DATA', alert);
        });
        
        // Options flow anomaly events
        this.flowAnomalyDetector.on('anomalyDetected', (anomaly) => {
            this.handleProtectionEvent('FLOW_ANOMALY', anomaly);
        });
        
        // Market microstructure events
        this.microstructure.on('microstructureAlert', (alert) => {
            this.handleProtectionEvent('MICROSTRUCTURE', alert);
        });
    }
    
    /**
     * Orchestrate all protection systems for current market conditions
     */
    async orchestrateProtection(marketData, positions, accountData) {
        const timestamp = new Date();
        const evaluations = [];
        
        // Run all protection evaluations in parallel
        const [
            treasuryRisk,
            assignmentRisk,
            pinningRisk,
            futuresRollRisk,
            momentumRisk,
            fridayRisk,
            economicRisk,
            flowRisk,
            microstructureRisk
        ] = await Promise.all([
            this.evaluateTreasuryRisk(marketData, timestamp),
            this.evaluateAssignmentRisk(positions, marketData, timestamp),
            this.evaluatePinningRisk(marketData, timestamp),
            this.evaluateFuturesRollRisk(positions, timestamp),
            this.evaluateMomentumRisk(marketData, timestamp),
            this.evaluateFridayRisk(marketData, timestamp),
            this.evaluateEconomicRisk(timestamp),
            this.evaluateFlowRisk(marketData, timestamp),
            this.evaluateMicrostructureRisk(marketData, timestamp)
        ]);
        
        // Aggregate risk assessments
        evaluations.push(treasuryRisk, assignmentRisk, pinningRisk, futuresRollRisk,
                        momentumRisk, fridayRisk, economicRisk, flowRisk, microstructureRisk);
        
        // Calculate composite risk level
        const compositeRisk = this.calculateCompositeRisk(evaluations);
        
        // Update protection state
        this.updateProtectionState(compositeRisk, evaluations);
        
        // Generate trading adjustments
        const adjustments = this.generateTradingAdjustments(compositeRisk);
        
        // Apply position-specific protections
        const protectedPositions = await this.applyPositionProtections(
            positions,
            adjustments,
            marketData
        );
        
        // Generate alerts for critical conditions
        const alerts = this.generateAlerts(evaluations, compositeRisk);
        
        return {
            timestamp,
            riskLevel: compositeRisk.level,
            riskScore: compositeRisk.score,
            activeProtections: Array.from(this.protectionState.activeProtections.values()),
            restrictions: Array.from(this.protectionState.restrictions),
            adjustments,
            protectedPositions,
            alerts,
            details: {
                treasury: treasuryRisk,
                assignment: assignmentRisk,
                pinning: pinningRisk,
                futuresRoll: futuresRollRisk,
                momentum: momentumRisk,
                friday: fridayRisk,
                economic: economicRisk,
                flow: flowRisk,
                microstructure: microstructureRisk
            }
        };
    }
    
    async evaluateTreasuryRisk(marketData, timestamp) {
        const auctions = await this.treasuryCalendar.getUpcomingAuctions(7);
        const currentProtection = this.treasuryCalendar.getCurrentProtectionStatus();
        
        let riskLevel = 'LOW';
        let riskScore = 0;
        const factors = [];
        
        // Check for auctions in next 24 hours
        const next24h = auctions.filter(a => {
            const hoursUntil = (new Date(a.auctionDate) - timestamp) / (1000 * 60 * 60);
            return hoursUntil <= 24 && hoursUntil >= 0;
        });
        
        if (next24h.length > 0) {
            const auction = next24h[0];
            const hoursUntil = (new Date(auction.auctionDate) - timestamp) / (1000 * 60 * 60);
            
            if (hoursUntil <= 2) {
                riskLevel = 'CRITICAL';
                riskScore = 90;
                factors.push(`${auction.securityType} auction in ${hoursUntil.toFixed(1)} hours`);
            } else if (hoursUntil <= 6) {
                riskLevel = 'HIGH';
                riskScore = 70;
                factors.push(`${auction.securityType} auction approaching`);
            } else {
                riskLevel = 'MEDIUM';
                riskScore = 50;
                factors.push(`${auction.securityType} auction tomorrow`);
            }
        }
        
        return { type: 'TREASURY', riskLevel, riskScore, factors, currentProtection };
    }
    
    async evaluateAssignmentRisk(positions, marketData, timestamp) {
        const assessments = await this.assignmentMonitor.assessAllPositions(
            positions,
            marketData,
            timestamp
        );
        
        let maxRisk = 'LOW';
        let maxScore = 0;
        const factors = [];
        
        for (const assessment of assessments) {
            if (assessment.riskLevel === 'CRITICAL' || assessment.assignmentProbability > 0.8) {
                maxRisk = 'CRITICAL';
                maxScore = Math.max(maxScore, 95);
                factors.push(`${assessment.symbol}: ${(assessment.assignmentProbability * 100).toFixed(0)}% assignment risk`);
            } else if (assessment.riskLevel === 'HIGH' || assessment.assignmentProbability > 0.5) {
                if (maxRisk !== 'CRITICAL') maxRisk = 'HIGH';
                maxScore = Math.max(maxScore, 75);
                factors.push(`${assessment.symbol}: Elevated assignment risk`);
            }
        }
        
        return { type: 'ASSIGNMENT', riskLevel: maxRisk, riskScore: maxScore, factors, assessments };
    }
    
    async evaluatePinningRisk(marketData, timestamp) {
        const hour = timestamp.getHours();
        const dayOfWeek = timestamp.getDay();
        const isExpirationDay = dayOfWeek === 5; // Friday
        
        let riskLevel = 'LOW';
        let riskScore = 0;
        const factors = [];
        
        if (isExpirationDay) {
            // Detect pins for major indices
            const symbols = ['SPY', 'QQQ', 'IWM'];
            for (const symbol of symbols) {
                const pinAnalysis = await this.pinningDetector.detectPin(
                    symbol,
                    marketData[symbol],
                    marketData.optionChain?.[symbol],
                    timestamp
                );
                
                if (pinAnalysis?.pinDetected) {
                    const strength = pinAnalysis.pinStrength || 0;
                    if (strength > 0.7) {
                        riskLevel = 'HIGH';
                        riskScore = Math.max(riskScore, 80);
                        factors.push(`${symbol} pinning at ${pinAnalysis.pinStrike}`);
                    } else if (strength > 0.5) {
                        if (riskLevel !== 'HIGH') riskLevel = 'MEDIUM';
                        riskScore = Math.max(riskScore, 60);
                        factors.push(`${symbol} potential pin at ${pinAnalysis.pinStrike}`);
                    }
                }
            }
            
            // Extra risk during power hour on expiration
            if (hour >= 15) {
                riskScore = Math.min(100, riskScore + 20);
                factors.push('Expiration day power hour');
            }
        }
        
        return { type: 'PINNING', riskLevel, riskScore, factors };
    }
    
    async evaluateFuturesRollRisk(positions, timestamp) {
        const rollDates = await this.futuresRollCalendar.getUpcomingRolls(14);
        const futuresPositions = positions.filter(p => p.instrumentType === 'FUTURE');
        
        let riskLevel = 'LOW';
        let riskScore = 0;
        const factors = [];
        
        for (const position of futuresPositions) {
            const rollInfo = rollDates.find(r => r.symbol === position.symbol);
            if (rollInfo) {
                const daysUntilRoll = Math.floor((new Date(rollInfo.rollDate) - timestamp) / (1000 * 60 * 60 * 24));
                
                if (daysUntilRoll <= 1) {
                    riskLevel = 'CRITICAL';
                    riskScore = 95;
                    factors.push(`${position.symbol} roll tomorrow`);
                } else if (daysUntilRoll <= 3) {
                    if (riskLevel !== 'CRITICAL') riskLevel = 'HIGH';
                    riskScore = Math.max(riskScore, 75);
                    factors.push(`${position.symbol} roll in ${daysUntilRoll} days`);
                } else if (daysUntilRoll <= 7) {
                    if (riskLevel !== 'CRITICAL' && riskLevel !== 'HIGH') riskLevel = 'MEDIUM';
                    riskScore = Math.max(riskScore, 50);
                    factors.push(`${position.symbol} roll approaching`);
                }
            }
        }
        
        return { type: 'FUTURES_ROLL', riskLevel, riskScore, factors };
    }
    
    async evaluateMomentumRisk(marketData, timestamp) {
        const analysis = await this.momentumProtection.analyzeMarketMomentum(marketData, timestamp);
        
        let riskLevel = 'LOW';
        let riskScore = analysis.riskScore || 0;
        const factors = [];
        
        if (analysis.spikeDetected) {
            if (analysis.magnitude > 2.5) {
                riskLevel = 'CRITICAL';
                riskScore = 90;
                factors.push(`${analysis.magnitude.toFixed(1)}% momentum spike detected`);
            } else if (analysis.magnitude > 1.5) {
                riskLevel = 'HIGH';
                riskScore = 70;
                factors.push(`Significant momentum surge`);
            }
            
            if (analysis.waitMinutes > 0) {
                factors.push(`Wait ${analysis.waitMinutes} minutes before entry`);
            }
        }
        
        return { type: 'MOMENTUM_SPIKE', riskLevel, riskScore, factors, analysis };
    }
    
    async evaluateFridayRisk(marketData, timestamp) {
        const analysis = await this.fridayProtection.analyzeFridayConditions(marketData, timestamp);
        
        if (!analysis.isFriday) {
            return { type: 'FRIDAY_PSYCHOLOGY', riskLevel: 'LOW', riskScore: 0, factors: [] };
        }
        
        let riskLevel = analysis.riskLevel || 'LOW';
        let riskScore = analysis.riskScore || 0;
        const factors = [];
        
        if (analysis.protectionActive) {
            factors.push('Friday psychology protection active');
            
            if (analysis.restrictions?.includes('NO_NEW_POSITIONS')) {
                factors.push('New positions restricted');
            }
            if (analysis.adjustments?.positionSizeMultiplier < 1) {
                factors.push(`Position size reduced to ${(analysis.adjustments.positionSizeMultiplier * 100).toFixed(0)}%`);
            }
        }
        
        return { type: 'FRIDAY_PSYCHOLOGY', riskLevel, riskScore, factors, analysis };
    }
    
    async evaluateEconomicRisk(timestamp) {
        const events = await this.economicCalendar.getUpcomingEvents(1); // Next 24 hours
        
        let riskLevel = 'LOW';
        let riskScore = 0;
        const factors = [];
        
        const highImpactEvents = events.filter(e => e.impact === 'HIGH');
        
        for (const event of highImpactEvents) {
            const hoursUntil = (new Date(event.datetime) - timestamp) / (1000 * 60 * 60);
            
            if (hoursUntil <= 1) {
                riskLevel = 'CRITICAL';
                riskScore = 85;
                factors.push(`${event.name} in ${Math.floor(hoursUntil * 60)} minutes`);
            } else if (hoursUntil <= 4) {
                if (riskLevel !== 'CRITICAL') riskLevel = 'HIGH';
                riskScore = Math.max(riskScore, 65);
                factors.push(`${event.name} at ${event.time}`);
            } else {
                if (riskLevel !== 'CRITICAL' && riskLevel !== 'HIGH') riskLevel = 'MEDIUM';
                riskScore = Math.max(riskScore, 45);
                factors.push(`${event.name} tomorrow`);
            }
        }
        
        return { type: 'ECONOMIC_DATA', riskLevel, riskScore, factors, events: highImpactEvents };
    }
    
    async evaluateFlowRisk(marketData, timestamp) {
        const anomalies = await this.flowAnomalyDetector.detectAnomalies(marketData, timestamp);
        
        let riskLevel = 'LOW';
        let riskScore = 0;
        const factors = [];
        
        if (anomalies && anomalies.length > 0) {
            const maxSeverity = Math.max(...anomalies.map(a => a.severity || 0));
            
            if (maxSeverity > 0.8) {
                riskLevel = 'HIGH';
                riskScore = 75;
                factors.push('Unusual options flow detected');
            } else if (maxSeverity > 0.6) {
                riskLevel = 'MEDIUM';
                riskScore = 55;
                factors.push('Elevated options activity');
            }
            
            // Check for specific patterns
            const largeBlocks = anomalies.filter(a => a.type === 'LARGE_BLOCK');
            if (largeBlocks.length > 3) {
                riskScore = Math.min(100, riskScore + 15);
                factors.push(`${largeBlocks.length} large block trades detected`);
            }
        }
        
        return { type: 'FLOW_ANOMALY', riskLevel, riskScore, factors, anomalies };
    }
    
    async evaluateMicrostructureRisk(marketData, timestamp) {
        const analysis = await this.microstructure.analyzeMarketConditions(marketData, timestamp);
        
        let riskLevel = 'LOW';
        let riskScore = 0;
        const factors = [];
        
        if (analysis) {
            // Check bid-ask spreads
            if (analysis.spreadWidening > 2.0) {
                riskLevel = 'HIGH';
                riskScore = 70;
                factors.push('Significant spread widening');
            } else if (analysis.spreadWidening > 1.5) {
                riskLevel = 'MEDIUM';
                riskScore = 50;
                factors.push('Moderate spread widening');
            }
            
            // Check liquidity
            if (analysis.liquidityScore < 0.3) {
                riskScore = Math.min(100, riskScore + 25);
                factors.push('Low liquidity conditions');
            }
            
            // Check order book imbalance
            if (Math.abs(analysis.orderBookImbalance || 0) > 0.7) {
                riskScore = Math.min(100, riskScore + 20);
                factors.push('Order book imbalance detected');
            }
        }
        
        return { type: 'MICROSTRUCTURE', riskLevel, riskScore, factors, analysis };
    }
    
    calculateCompositeRisk(evaluations) {
        // Weight different risk types
        const weights = {
            TREASURY: 0.15,
            ASSIGNMENT: 0.20,
            PINNING: 0.10,
            FUTURES_ROLL: 0.15,
            MOMENTUM_SPIKE: 0.15,
            FRIDAY_PSYCHOLOGY: 0.05,
            ECONOMIC_DATA: 0.10,
            FLOW_ANOMALY: 0.05,
            MICROSTRUCTURE: 0.05
        };
        
        let weightedScore = 0;
        let maxScore = 0;
        let criticalCount = 0;
        let highCount = 0;
        
        for (const evaluation of evaluations) {
            const weight = weights[evaluation.type] || 0.1;
            weightedScore += evaluation.riskScore * weight;
            maxScore = Math.max(maxScore, evaluation.riskScore);
            
            if (evaluation.riskLevel === 'CRITICAL') criticalCount++;
            if (evaluation.riskLevel === 'HIGH') highCount++;
        }
        
        // Determine overall risk level
        let level = 'NORMAL';
        if (criticalCount > 0 || maxScore >= 85) {
            level = 'CRITICAL';
        } else if (highCount >= 2 || maxScore >= 70) {
            level = 'HIGH';
        } else if (highCount >= 1 || weightedScore >= 50) {
            level = 'ELEVATED';
        } else if (weightedScore >= 30) {
            level = 'MODERATE';
        }
        
        return {
            level,
            score: Math.min(100, weightedScore),
            maxScore,
            criticalCount,
            highCount
        };
    }
    
    updateProtectionState(compositeRisk, evaluations) {
        this.protectionState.overallRiskLevel = compositeRisk.level;
        this.protectionState.lastUpdate = new Date();
        
        // Clear old protections
        this.protectionState.activeProtections.clear();
        this.protectionState.restrictions.clear();
        
        // Add active protections
        for (const evaluation of evaluations) {
            if (evaluation.riskScore > 30) {
                this.protectionState.activeProtections.set(evaluation.type, {
                    type: evaluation.type,
                    level: evaluation.riskLevel,
                    score: evaluation.riskScore,
                    factors: evaluation.factors
                });
            }
        }
        
        // Set restrictions based on risk level
        if (compositeRisk.level === 'CRITICAL') {
            this.protectionState.restrictions.add('NO_NEW_POSITIONS');
            this.protectionState.restrictions.add('REDUCE_POSITION_SIZE');
            this.protectionState.restrictions.add('TIGHTEN_STOPS');
        } else if (compositeRisk.level === 'HIGH') {
            this.protectionState.restrictions.add('REDUCE_POSITION_SIZE');
            this.protectionState.restrictions.add('INCREASE_ENTRY_THRESHOLD');
        }
    }
    
    generateTradingAdjustments(compositeRisk) {
        const adjustments = {
            positionSize: 1.0,
            stopLoss: 1.0,
            profitTarget: 1.0,
            maxBPUsage: 1.0,
            entryThreshold: 1.0,
            allowNewPositions: true,
            requireConfirmation: false
        };
        
        switch (compositeRisk.level) {
            case 'CRITICAL':
                adjustments.positionSize = 0.25;
                adjustments.stopLoss = 0.75; // Tighter stops
                adjustments.profitTarget = 0.80; // Lower profit targets
                adjustments.maxBPUsage = 0.50;
                adjustments.entryThreshold = 1.5; // Much higher threshold
                adjustments.allowNewPositions = false;
                adjustments.requireConfirmation = true;
                break;
                
            case 'HIGH':
                adjustments.positionSize = 0.50;
                adjustments.stopLoss = 0.85;
                adjustments.profitTarget = 0.90;
                adjustments.maxBPUsage = 0.70;
                adjustments.entryThreshold = 1.3;
                adjustments.requireConfirmation = true;
                break;
                
            case 'ELEVATED':
                adjustments.positionSize = 0.75;
                adjustments.stopLoss = 0.95;
                adjustments.profitTarget = 0.95;
                adjustments.maxBPUsage = 0.85;
                adjustments.entryThreshold = 1.15;
                break;
                
            case 'MODERATE':
                adjustments.positionSize = 0.90;
                adjustments.maxBPUsage = 0.95;
                adjustments.entryThreshold = 1.05;
                break;
        }
        
        this.protectionState.adjustmentFactors = adjustments;
        return adjustments;
    }
    
    async applyPositionProtections(positions, adjustments, marketData) {
        const protectedPositions = [];
        
        for (const position of positions) {
            const protectedPosition = { ...position };
            
            // Apply stop loss adjustments
            if (protectedPosition.stopLoss) {
                protectedPosition.adjustedStopLoss = protectedPosition.stopLoss * adjustments.stopLoss;
            }
            
            // Apply profit target adjustments
            if (protectedPosition.profitTarget) {
                protectedPosition.adjustedProfitTarget = protectedPosition.profitTarget * adjustments.profitTarget;
            }
            
            // Check position-specific risks
            if (position.daysToExpiration <= 7) {
                protectedPosition.warnings = protectedPosition.warnings || [];
                protectedPosition.warnings.push('Approaching expiration');
            }
            
            // Add protection recommendations
            protectedPosition.protectionRecommendations = this.getPositionRecommendations(
                position,
                this.protectionState.activeProtections,
                marketData
            );
            
            protectedPositions.push(protectedPosition);
        }
        
        return protectedPositions;
    }
    
    getPositionRecommendations(position, activeProtections, marketData) {
        const recommendations = [];
        
        // Check for assignment risk
        if (activeProtections.has('ASSIGNMENT') && position.instrumentType === 'OPTION') {
            if (position.type === 'SHORT_PUT' && position.strike >= marketData[position.symbol]?.currentPrice) {
                recommendations.push('Consider rolling or closing - assignment risk');
            }
        }
        
        // Check for pinning risk
        if (activeProtections.has('PINNING') && position.daysToExpiration === 0) {
            recommendations.push('Monitor for pinning action at expiration');
        }
        
        // Check for momentum spike
        if (activeProtections.has('MOMENTUM_SPIKE')) {
            recommendations.push('Wait for momentum to stabilize before adjusting');
        }
        
        return recommendations;
    }
    
    generateAlerts(evaluations, compositeRisk) {
        const alerts = [];
        
        // Critical risk alert
        if (compositeRisk.level === 'CRITICAL') {
            alerts.push({
                priority: this.PRIORITY.CRITICAL,
                message: 'CRITICAL RISK DETECTED - Trading restricted',
                timestamp: new Date(),
                details: evaluations.filter(e => e.riskLevel === 'CRITICAL')
            });
        }
        
        // Individual system alerts
        for (const evaluation of evaluations) {
            if (evaluation.riskLevel === 'CRITICAL' || evaluation.riskLevel === 'HIGH') {
                alerts.push({
                    priority: evaluation.riskLevel === 'CRITICAL' ? this.PRIORITY.CRITICAL : this.PRIORITY.HIGH,
                    message: `${evaluation.type}: ${evaluation.factors.join(', ')}`,
                    timestamp: new Date(),
                    type: evaluation.type,
                    riskScore: evaluation.riskScore
                });
            }
        }
        
        // Sort by priority
        alerts.sort((a, b) => b.priority - a.priority);
        
        this.protectionState.alerts = alerts;
        return alerts;
    }
    
    handleProtectionEvent(type, eventData) {
        this.emit('protectionEvent', {
            type,
            data: eventData,
            timestamp: new Date()
        });
        
        // Log critical events
        if (eventData.severity === 'CRITICAL' || eventData.riskLevel === 'CRITICAL') {
            console.log(`[CRITICAL PROTECTION] ${type}:`, eventData);
        }
    }
    
    /**
     * Get current protection status
     */
    getProtectionStatus() {
        return {
            ...this.protectionState,
            activeProtections: Array.from(this.protectionState.activeProtections.values()),
            restrictions: Array.from(this.protectionState.restrictions)
        };
    }
    
    /**
     * Override protection (admin function)
     */
    overrideProtection(type, enabled = false) {
        if (enabled) {
            this.protectionState.activeProtections.delete(type);
            console.log(`Protection ${type} manually disabled`);
        } else {
            this.protectionState.activeProtections.set(type, {
                type,
                level: 'MANUAL',
                score: 100,
                factors: ['Manually enabled']
            });
            console.log(`Protection ${type} manually enabled`);
        }
        
        this.emit('protectionOverride', { type, enabled });
    }
}

module.exports = UnifiedProtectionOrchestrator;