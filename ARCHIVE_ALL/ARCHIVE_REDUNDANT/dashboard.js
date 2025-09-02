/**
 * Tom King Trading Framework Dashboard
 * Professional trading dashboard with real-time data updates
 */

class TomKingDashboard {
    constructor() {
        this.isInitialized = false;
        this.websocket = null;
        this.refreshInterval = null;
        this.refreshCountdown = 5;
        this.charts = {};
        this.positions = [];
        this.accountData = {
            currentValue: 35000,
            dailyPL: 0,
            monthlyPL: 0,
            buyingPower: 0,
            goalProgress: 0
        };
        this.vixData = {
            current: 18.5,
            regime: 3
        };
        this.correlationGroups = {
            indices: 0,
            commodities: 0,
            fixedIncome: 0
        };
        this.alerts = [];
        
        this.init();
    }

    async init() {
        try {
            await this.showLoadingScreen();
            await this.initializeCharts();
            await this.initializeWebSocket();
            await this.bindEventListeners();
            await this.loadInitialData();
            await this.startRefreshCycle();
            
            this.hideLoadingScreen();
            this.isInitialized = true;
            console.log('Tom King Dashboard initialized successfully');
        } catch (error) {
            console.error('Dashboard initialization failed:', error);
            this.showError('Failed to initialize dashboard');
        }
    }

    showLoadingScreen() {
        return new Promise(resolve => {
            const loadingScreen = document.getElementById('loadingScreen');
            loadingScreen.style.display = 'flex';
            setTimeout(resolve, 1500); // Simulate initialization time
        });
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        const dashboardContainer = document.getElementById('dashboardContainer');
        
        loadingScreen.style.display = 'none';
        dashboardContainer.style.display = 'block';
    }

    async initializeCharts() {
        // Account Value Chart
        const accountCtx = document.getElementById('accountChart').getContext('2d');
        this.charts.account = new Chart(accountCtx, {
            type: 'line',
            data: {
                labels: this.generateDateLabels(30), // Last 30 days
                datasets: [{
                    label: 'Account Value',
                    data: this.generateAccountData(),
                    borderColor: '#00FFFF',
                    backgroundColor: 'rgba(0, 255, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }, {
                    label: 'Goal Target',
                    data: this.generateGoalLine(),
                    borderColor: '#FFD700',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#ffffff' }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#ffffff' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        ticks: { 
                            color: '#ffffff',
                            callback: function(value) {
                                return '£' + value.toLocaleString();
                            }
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });

        // Performance Chart
        const performanceCtx = document.getElementById('performanceChart').getContext('2d');
        this.charts.performance = new Chart(performanceCtx, {
            type: 'bar',
            data: {
                labels: ['0DTE Friday', '45DTE Strangles', 'Long 112', 'Futures'],
                datasets: [{
                    label: 'Strategy P&L',
                    data: [0, 0, 0, 0],
                    backgroundColor: ['#00FF00', '#00FFFF', '#FFD700', '#FF6B6B'],
                    borderColor: ['#00CC00', '#00CCCC', '#FFB700', '#FF4444'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        ticks: { color: '#ffffff' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        ticks: { 
                            color: '#ffffff',
                            callback: function(value) {
                                return '£' + value.toLocaleString();
                            }
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });
    }

    generateDateLabels(days) {
        const labels = [];
        const today = new Date();
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }));
        }
        return labels;
    }

    generateAccountData() {
        // Simulate account growth from £35k
        const data = [];
        const startValue = 35000;
        const targetGrowth = 0.0667; // 6.67% monthly target
        
        for (let i = 0; i < 30; i++) {
            const dailyGrowth = (Math.random() - 0.4) * 0.02; // Random daily changes
            const baseGrowth = targetGrowth / 30; // Daily portion of monthly target
            const value = startValue * (1 + (baseGrowth + dailyGrowth) * i);
            data.push(Math.round(value));
        }
        return data;
    }

    generateGoalLine() {
        // Generate goal progression line to £80k in 8 months
        const data = [];
        const startValue = 35000;
        const targetValue = 80000;
        const monthsToGoal = 8;
        const dailyGrowth = Math.pow(targetValue / startValue, 1 / (monthsToGoal * 30)) - 1;
        
        for (let i = 0; i < 30; i++) {
            const value = startValue * Math.pow(1 + dailyGrowth, i);
            data.push(Math.round(value));
        }
        return data;
    }

    async initializeWebSocket() {
        try {
            // Note: This is a placeholder for WebSocket connection
            // In production, this would connect to the actual TastyTrade WebSocket
            console.log('Initializing WebSocket connection...');
            
            // Simulate WebSocket connection
            setTimeout(() => {
                this.updateConnectionStatus(true);
                this.simulateMarketData();
            }, 1000);
            
        } catch (error) {
            console.error('WebSocket initialization failed:', error);
            this.updateConnectionStatus(false);
        }
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus');
        if (connected) {
            statusElement.classList.remove('offline');
            statusElement.classList.add('online');
            statusElement.querySelector('span:last-child').textContent = 'API Connected';
        } else {
            statusElement.classList.remove('online');
            statusElement.classList.add('offline');
            statusElement.querySelector('span:last-child').textContent = 'API Offline';
        }
    }

    simulateMarketData() {
        // Simulate receiving market data updates
        setInterval(() => {
            this.updateVixData();
            this.updateMarketTime();
            this.checkForAlerts();
        }, 5000);
    }

    bindEventListeners() {
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshData();
        });

        // Export button
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.showExportModal();
        });

        // Generate recommendations
        document.getElementById('generateRecommendationsBtn').addEventListener('click', () => {
            this.generateRecommendations();
        });

        // Add position button
        document.getElementById('addPositionBtn').addEventListener('click', () => {
            this.showAddPositionModal();
        });

        // Time period buttons
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.updatePerformanceChart(e.target.dataset.period);
            });
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.closeModal(e.target.closest('.modal'));
            });
        });

        // Modal action buttons
        document.getElementById('confirmExport').addEventListener('click', () => {
            this.executeExport();
        });

        document.getElementById('cancelExport').addEventListener('click', () => {
            this.closeModal(document.getElementById('exportModal'));
        });

        document.getElementById('confirmAddPosition').addEventListener('click', () => {
            this.addNewPosition();
        });

        document.getElementById('cancelAddPosition').addEventListener('click', () => {
            this.closeModal(document.getElementById('addPositionModal'));
        });

        // Click outside modal to close
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target);
            }
        });
    }

    async loadInitialData() {
        // Load initial account data
        this.updateAccountDisplay();
        this.updatePositionsDisplay();
        this.updateRiskDisplay();
        this.updateVixDisplay();
        this.updateStrategyPerformance();
        this.updateComplianceDisplay();
        this.updateAlertsDisplay();
        this.updateMarketStatus();
        this.updateTimestamp();
    }

    updateAccountDisplay() {
        document.getElementById('accountValue').textContent = `£${this.accountData.currentValue.toLocaleString()}`;
        document.getElementById('currentValue').textContent = `£${this.accountData.currentValue.toLocaleString()}`;
        
        const dailyPLElement = document.getElementById('dailyPL');
        dailyPLElement.textContent = `${this.accountData.dailyPL >= 0 ? '+' : ''}£${this.accountData.dailyPL.toLocaleString()}`;
        dailyPLElement.className = `value ${this.accountData.dailyPL >= 0 ? 'profit' : 'loss'}`;
        
        const monthlyPLElement = document.getElementById('monthlyPL');
        monthlyPLElement.textContent = `${this.accountData.monthlyPL >= 0 ? '+' : ''}£${this.accountData.monthlyPL.toLocaleString()}`;
        monthlyPLElement.className = `value ${this.accountData.monthlyPL >= 0 ? 'profit' : 'loss'}`;
        
        const progress = ((this.accountData.currentValue - 35000) / (80000 - 35000) * 100).toFixed(1);
        document.getElementById('goalProgress').textContent = `${progress}%`;
        
        // Update account phase
        let phase = 'Phase 1';
        if (this.accountData.currentValue >= 75000) phase = 'Phase 4';
        else if (this.accountData.currentValue >= 60000) phase = 'Phase 3';
        else if (this.accountData.currentValue >= 40000) phase = 'Phase 2';
        
        document.getElementById('accountPhase').textContent = phase;
    }

    updatePositionsDisplay() {
        const positionsTable = document.getElementById('positionsTable');
        const positionCount = document.getElementById('positionCount');
        
        if (this.positions.length === 0) {
            positionsTable.innerHTML = `
                <div class="no-positions">
                    <p>No active positions</p>
                    <button class="action-btn secondary" id="addPositionBtn">Add Position</button>
                </div>
            `;
            // Rebind the event listener for the new button
            document.getElementById('addPositionBtn').addEventListener('click', () => {
                this.showAddPositionModal();
            });
        } else {
            positionsTable.innerHTML = `
                <div class="positions-header">
                    <span>Symbol</span>
                    <span>Strategy</span>
                    <span>Size</span>
                    <span>P&L</span>
                    <span>DTE</span>
                    <span>Actions</span>
                </div>
                ${this.positions.map(position => `
                    <div class="position-row">
                        <span class="symbol">${position.symbol}</span>
                        <span class="strategy">${position.strategy}</span>
                        <span class="size">£${position.size.toLocaleString()}</span>
                        <span class="pl ${position.pl >= 0 ? 'profit' : 'loss'}">
                            ${position.pl >= 0 ? '+' : ''}£${position.pl.toLocaleString()}
                        </span>
                        <span class="dte">${position.dte}</span>
                        <span class="actions">
                            <button class="action-btn small" onclick="dashboard.managePosition('${position.id}')">Manage</button>
                            <button class="action-btn small danger" onclick="dashboard.closePosition('${position.id}')">Close</button>
                        </span>
                    </div>
                `).join('')}
            `;
        }
        
        positionCount.textContent = this.positions.length;
    }

    updateRiskDisplay() {
        // Update buying power gauge
        const buyingPowerUsage = (this.accountData.buyingPower / this.accountData.currentValue * 100);
        const gauge = document.getElementById('buyingPowerGauge');
        const fill = gauge.querySelector('.gauge-fill');
        const valueText = gauge.querySelector('.gauge-value');
        
        fill.style.transform = `rotate(${buyingPowerUsage * 1.8}deg)`; // 180 degrees = 100%
        valueText.textContent = `${buyingPowerUsage.toFixed(1)}%`;
        
        // Color coding for buying power
        if (buyingPowerUsage > 35) {
            fill.style.backgroundColor = '#ff4444';
            gauge.classList.add('danger');
        } else if (buyingPowerUsage > 25) {
            fill.style.backgroundColor = '#ffaa00';
            gauge.classList.add('warning');
        } else {
            fill.style.backgroundColor = '#00ff00';
            gauge.classList.remove('danger', 'warning');
        }
        
        // Update correlation groups
        const correlationStatus = document.getElementById('correlationStatus');
        const groups = ['Indices', 'Commodities', 'Fixed Income'];
        const groupCounts = [this.correlationGroups.indices, this.correlationGroups.commodities, this.correlationGroups.fixedIncome];
        
        correlationStatus.innerHTML = groups.map((group, index) => `
            <div class="correlation-group">
                <span class="group-name">${group}</span>
                <span class="group-count">${groupCounts[index]}/3</span>
                <div class="group-bar">
                    <div class="group-fill" style="width: ${(groupCounts[index] / 3) * 100}%"></div>
                </div>
            </div>
        `).join('');
    }

    updateVixDisplay() {
        document.getElementById('vixValue').textContent = this.vixData.current.toFixed(1);
        
        // Update VIX regime indicators
        document.querySelectorAll('.vix-level').forEach(level => {
            level.classList.remove('active');
        });
        
        document.querySelector(`[data-level="${this.vixData.regime}"]`).classList.add('active');
        
        // Update position sizing multiplier based on VIX regime
        const multipliers = [0.5, 0.75, 1.0, 1.25, 1.5];
        const multiplier = multipliers[this.vixData.regime - 1];
        document.getElementById('positionSizeMultiplier').textContent = `${multiplier}x`;
    }

    updateStrategyPerformance() {
        // This would normally come from actual trading data
        const strategyData = {
            '0dte': { trades: 0, pl: 0, winRate: 100 },
            'strangle': { trades: 0, pl: 0, winRate: 0 },
            'long112': { trades: 0, pl: 0, winRate: 0 },
            'futures': { trades: 0, pl: 0, winRate: 0 }
        };
        
        document.querySelectorAll('.strategy-item').forEach(item => {
            const strategy = item.dataset.strategy;
            const data = strategyData[strategy];
            
            item.querySelector('.win-rate').textContent = `${data.winRate}%`;
            item.querySelector('.metric').textContent = `Trades: ${data.trades}`;
            
            const plElement = item.querySelectorAll('.metric')[1];
            plElement.textContent = `P&L: ${data.pl >= 0 ? '+' : ''}£${data.pl.toLocaleString()}`;
            plElement.className = `metric ${data.pl >= 0 ? 'profit' : 'loss'}`;
        });
    }

    updateComplianceDisplay() {
        // All rules are compliant by default
        const rules = document.querySelectorAll('.rule-item');
        let compliantCount = 0;
        
        rules.forEach(rule => {
            // This would normally check actual compliance
            rule.classList.add('compliant');
            rule.querySelector('.rule-icon').textContent = '✅';
            rule.querySelector('.rule-status').textContent = 'Compliant';
            compliantCount++;
        });
        
        const complianceScore = (compliantCount / rules.length * 100).toFixed(0);
        document.getElementById('complianceScore').textContent = `${complianceScore}%`;
    }

    updateAlertsDisplay() {
        const alertsContainer = document.getElementById('alertsContainer');
        const alertCount = document.getElementById('alertCount');
        
        if (this.alerts.length === 0) {
            alertsContainer.innerHTML = `
                <div class="no-alerts">
                    <span class="icon">✅</span>
                    <p>All systems green</p>
                </div>
            `;
            alertCount.textContent = '0';
            alertCount.className = 'badge';
        } else {
            alertsContainer.innerHTML = this.alerts.map(alert => `
                <div class="alert-item ${alert.severity}">
                    <span class="alert-icon">${alert.icon}</span>
                    <div class="alert-content">
                        <span class="alert-title">${alert.title}</span>
                        <span class="alert-message">${alert.message}</span>
                    </div>
                    <span class="alert-time">${alert.time}</span>
                </div>
            `).join('');
            
            alertCount.textContent = this.alerts.length;
            alertCount.className = 'badge alert';
        }
    }

    updateMarketStatus() {
        const now = new Date();
        const marketOpen = new Date(now);
        marketOpen.setHours(14, 30, 0); // 2:30 PM GMT (market open)
        const marketClose = new Date(now);
        marketClose.setHours(21, 0, 0); // 9:00 PM GMT (market close)
        
        const isMarketOpen = now >= marketOpen && now <= marketClose && now.getDay() >= 1 && now.getDay() <= 5;
        
        const marketStatus = document.getElementById('marketStatus');
        if (isMarketOpen) {
            marketStatus.classList.add('online');
            marketStatus.querySelector('span:last-child').textContent = 'Market Open';
        } else {
            marketStatus.classList.remove('online');
            marketStatus.querySelector('span:last-child').textContent = 'Market Closed';
        }
    }

    updateMarketTime() {
        const now = new Date();
        document.getElementById('marketTime').textContent = now.toLocaleTimeString('en-GB');
    }

    updateTimestamp() {
        const now = new Date();
        document.getElementById('lastUpdate').textContent = `Last updated: ${now.toLocaleTimeString('en-GB')}`;
    }

    startRefreshCycle() {
        this.refreshInterval = setInterval(() => {
            this.refreshCountdown--;
            document.getElementById('refreshCountdown').textContent = this.refreshCountdown;
            
            if (this.refreshCountdown <= 0) {
                this.refreshData();
                this.refreshCountdown = 5;
            }
        }, 1000);
    }

    refreshData() {
        console.log('Refreshing dashboard data...');
        
        // Simulate data updates
        this.simulateDataUpdate();
        
        // Update all displays
        this.updateAccountDisplay();
        this.updatePositionsDisplay();
        this.updateRiskDisplay();
        this.updateVixDisplay();
        this.updateStrategyPerformance();
        this.updateComplianceDisplay();
        this.updateAlertsDisplay();
        this.updateMarketStatus();
        this.updateTimestamp();
        
        // Update charts
        this.updateCharts();
        
        this.refreshCountdown = 5;
    }

    simulateDataUpdate() {
        // Simulate small account value changes
        const change = (Math.random() - 0.5) * 100;
        this.accountData.dailyPL += change;
        this.accountData.currentValue += change;
        
        // Simulate VIX changes
        this.vixData.current += (Math.random() - 0.5) * 0.5;
        this.vixData.current = Math.max(10, Math.min(50, this.vixData.current));
        
        // Update VIX regime
        if (this.vixData.current < 12) this.vixData.regime = 1;
        else if (this.vixData.current < 16) this.vixData.regime = 2;
        else if (this.vixData.current < 20) this.vixData.regime = 3;
        else if (this.vixData.current < 30) this.vixData.regime = 4;
        else this.vixData.regime = 5;
    }

    updateVixData() {
        this.vixData.current += (Math.random() - 0.5) * 0.2;
        this.vixData.current = Math.max(10, Math.min(50, this.vixData.current));
        this.updateVixDisplay();
    }

    updateCharts() {
        // Update account chart with new data point
        const accountChart = this.charts.account;
        const newValue = this.accountData.currentValue;
        
        accountChart.data.datasets[0].data.shift();
        accountChart.data.datasets[0].data.push(newValue);
        
        accountChart.data.labels.shift();
        accountChart.data.labels.push(new Date().toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }));
        
        accountChart.update('none');
    }

    updatePerformanceChart(period) {
        console.log(`Updating performance chart for period: ${period}`);
        // This would update the performance chart based on the selected time period
        // Implementation would depend on actual data structure
    }

    checkForAlerts() {
        // Check various conditions that might trigger alerts
        
        // Buying power check
        const buyingPowerUsage = (this.accountData.buyingPower / this.accountData.currentValue * 100);
        if (buyingPowerUsage > 35) {
            this.addAlert({
                id: 'bp_limit',
                severity: 'critical',
                icon: '🚨',
                title: 'Buying Power Limit Exceeded',
                message: `Buying power usage: ${buyingPowerUsage.toFixed(1)}% (Limit: 35%)`,
                time: new Date().toLocaleTimeString('en-GB')
            });
        }
        
        // VIX regime change check
        if (this.vixData.current > 30) {
            this.addAlert({
                id: 'vix_high',
                severity: 'warning',
                icon: '⚠️',
                title: 'High VIX Regime',
                message: `VIX: ${this.vixData.current.toFixed(1)} - Consider reduced position sizing`,
                time: new Date().toLocaleTimeString('en-GB')
            });
        }
    }

    addAlert(alert) {
        // Check if alert already exists
        const existingAlert = this.alerts.find(a => a.id === alert.id);
        if (!existingAlert) {
            this.alerts.unshift(alert);
            // Keep only last 10 alerts
            this.alerts = this.alerts.slice(0, 10);
            this.updateAlertsDisplay();
        }
    }

    generateRecommendations() {
        const container = document.getElementById('recommendationsContainer');
        container.innerHTML = '<div class="loading">Analyzing market conditions...</div>';
        
        setTimeout(() => {
            const recommendations = this.getRecommendations();
            container.innerHTML = recommendations.map(rec => `
                <div class="recommendation-item ${rec.priority}">
                    <div class="rec-header">
                        <span class="rec-symbol">${rec.symbol}</span>
                        <span class="rec-strategy">${rec.strategy}</span>
                        <span class="rec-priority">${rec.priority.toUpperCase()}</span>
                    </div>
                    <div class="rec-details">
                        <p>${rec.description}</p>
                        <div class="rec-metrics">
                            <span>Expected: ${rec.expectedReturn}</span>
                            <span>Risk: ${rec.risk}</span>
                            <span>DTE: ${rec.dte}</span>
                        </div>
                    </div>
                    <div class="rec-actions">
                        <button class="action-btn small primary">Execute</button>
                        <button class="action-btn small secondary">Details</button>
                    </div>
                </div>
            `).join('');
        }, 2000);
    }

    getRecommendations() {
        // This would normally use the pattern analysis engine
        return [
            {
                symbol: 'SPY',
                strategy: '0DTE Friday',
                priority: 'high',
                description: 'Market conditions favorable for 0DTE trade. Low volatility environment.',
                expectedReturn: '+2.5%',
                risk: 'Low',
                dte: '0'
            },
            {
                symbol: 'TLT',
                strategy: '45DTE Strangle',
                priority: 'medium',
                description: 'High IV rank suggests premium selling opportunity.',
                expectedReturn: '+1.8%',
                risk: 'Medium',
                dte: '45'
            }
        ];
    }

    showExportModal() {
        document.getElementById('exportModal').classList.remove('hidden');
    }

    showAddPositionModal() {
        document.getElementById('addPositionModal').classList.remove('hidden');
    }

    closeModal(modal) {
        modal.classList.add('hidden');
    }

    executeExport() {
        const format = document.getElementById('exportFormat').value;
        const includePositions = document.getElementById('exportPositions').checked;
        const includePerformance = document.getElementById('exportPerformance').checked;
        const includeAlerts = document.getElementById('exportAlerts').checked;
        
        const data = {};
        if (includePositions) data.positions = this.positions;
        if (includePerformance) data.performance = this.accountData;
        if (includeAlerts) data.alerts = this.alerts;
        
        this.exportData(data, format);
        this.closeModal(document.getElementById('exportModal'));
    }

    exportData(data, format) {
        const timestamp = new Date().toISOString().split('T')[0];
        
        switch (format) {
            case 'csv':
                this.downloadCSV(data, `tom_king_dashboard_${timestamp}.csv`);
                break;
            case 'json':
                this.downloadJSON(data, `tom_king_dashboard_${timestamp}.json`);
                break;
            case 'pdf':
                this.generatePDFReport(data);
                break;
        }
    }

    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    downloadCSV(data, filename) {
        // Convert data to CSV format
        let csv = 'Type,Symbol,Strategy,Size,P&L,DTE\n';
        
        if (data.positions) {
            data.positions.forEach(pos => {
                csv += `Position,${pos.symbol},${pos.strategy},${pos.size},${pos.pl},${pos.dte}\n`;
            });
        }
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    generatePDFReport(data) {
        console.log('PDF generation would be implemented here');
        alert('PDF report functionality would be integrated with a PDF library like jsPDF');
    }

    addNewPosition() {
        const symbol = document.getElementById('newPositionSymbol').value;
        const strategy = document.getElementById('newPositionStrategy').value;
        const size = parseInt(document.getElementById('newPositionSize').value);
        
        if (!symbol || !size) {
            alert('Please fill in all required fields');
            return;
        }
        
        const newPosition = {
            id: Date.now().toString(),
            symbol: symbol.toUpperCase(),
            strategy: strategy,
            size: size,
            pl: 0,
            dte: this.calculateDTE(strategy),
            timestamp: new Date().toISOString()
        };
        
        this.positions.push(newPosition);
        this.updatePositionsDisplay();
        this.closeModal(document.getElementById('addPositionModal'));
        
        // Clear form
        document.getElementById('newPositionSymbol').value = '';
        document.getElementById('newPositionSize').value = '';
    }

    calculateDTE(strategy) {
        switch (strategy) {
            case '0dte': return 0;
            case 'strangle': return 45;
            case 'long112': return 112;
            case 'futures': return 45;
            default: return 0;
        }
    }

    managePosition(positionId) {
        const position = this.positions.find(p => p.id === positionId);
        if (position) {
            console.log('Managing position:', position);
            // This would open a position management dialog
        }
    }

    closePosition(positionId) {
        if (confirm('Are you sure you want to close this position?')) {
            this.positions = this.positions.filter(p => p.id !== positionId);
            this.updatePositionsDisplay();
        }
    }

    showError(message) {
        // Show error notification
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new TomKingDashboard();
});

// Export for global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TomKingDashboard;
}