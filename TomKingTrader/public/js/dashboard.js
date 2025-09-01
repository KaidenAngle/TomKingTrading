/**
 * TomKingTrader Dashboard JavaScript Client
 * Handles WebSocket connections, UI updates, and user interactions
 */

class TomKingDashboard {
    constructor() {
        // Configuration
        this.config = {
            apiUrl: window.location.origin,
            wsUrl: `ws://${window.location.hostname}:3001`,
            reconnectAttempts: 5,
            reconnectDelay: 5000,
            heartbeatInterval: 30000
        };
        
        // State
        this.ws = null;
        this.wsReconnectAttempts = 0;
        this.isConnected = false;
        this.isInitialized = false;
        this.currentAnalysis = null;
        this.activeSignals = [];
        
        // UI Elements
        this.elements = {};
        
        // Charts
        this.charts = {
            pnl: null,
            greeks: null,
            risk: null,
            bp: null
        };
        
        // Heartbeat timer
        this.heartbeatTimer = null;
        
        console.log('🚀 TomKingDashboard initializing...');
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }
    
    /**
     * Initialize the dashboard
     */
    async initialize() {
        console.log('📊 Dashboard initialization started');
        
        try {
            // Cache DOM elements
            this.cacheElements();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup tab functionality
            this.setupTabs();
            
            // Initialize charts
            this.initializeCharts();
            
            // Connect WebSocket
            this.connectWebSocket();
            
            // Start heartbeat
            this.startHeartbeat();
            
            console.log('✅ Dashboard initialized successfully');
            
        } catch (error) {
            console.error('🚨 Dashboard initialization failed:', error);
            this.showNotification('Dashboard initialization failed', 'error');
        }
    }
    
    /**
     * Cache DOM elements
     */
    cacheElements() {
        // Status elements
        this.elements.connectionStatus = document.getElementById('connectionStatus');
        this.elements.statusIndicator = document.getElementById('statusIndicator');
        this.elements.statusText = document.getElementById('statusText');
        this.elements.modeSwitch = document.getElementById('modeSwitch');
        
        // Status panel
        this.elements.accountPhase = document.getElementById('accountPhase');
        this.elements.accountValue = document.getElementById('accountValue');
        this.elements.positionCount = document.getElementById('positionCount');
        this.elements.bpUsage = document.getElementById('bpUsage');
        this.elements.riskLevel = document.getElementById('riskLevel');
        this.elements.vixRegime = document.getElementById('vixRegime');
        this.elements.lastUpdate = document.getElementById('lastUpdate');
        this.elements.activeSignals = document.getElementById('activeSignals');
        
        // Forms
        this.elements.initForm = document.getElementById('initForm');
        this.elements.initPanel = document.getElementById('initPanel');
        this.elements.initButton = document.getElementById('initButton');
        this.elements.manualPanel = document.getElementById('manualPanel');
        this.elements.marketDataForm = document.getElementById('marketDataForm');
        this.elements.positionsForm = document.getElementById('positionsForm');
        this.elements.analysisForm = document.getElementById('analysisForm');
        this.elements.runAnalysisBtn = document.getElementById('runAnalysisBtn');
        
        // Lists and content
        this.elements.signalsList = document.getElementById('signalsList');
        this.elements.positionsList = document.getElementById('positionsList');
        this.elements.patternsResults = document.getElementById('patternsResults');
        
        // Signal stats
        this.elements.entrySignals = document.getElementById('entrySignals');
        this.elements.exitSignals = document.getElementById('exitSignals');
        this.elements.riskSignals = document.getElementById('riskSignals');
        
        // Position stats
        this.elements.totalPositions = document.getElementById('totalPositions');
        this.elements.profitablePositions = document.getElementById('profitablePositions');
        this.elements.riskPositions = document.getElementById('riskPositions');
        
        // Greeks
        this.elements.netDelta = document.getElementById('netDelta');
        this.elements.netGamma = document.getElementById('netGamma');
        this.elements.netTheta = document.getElementById('netTheta');
        this.elements.netVega = document.getElementById('netVega');
        
        // Risk
        this.elements.correlationGroups = document.getElementById('correlationGroups');
        this.elements.vixAnalysis = document.getElementById('vixAnalysis');
        
        // Footer
        this.elements.footerStatus = document.getElementById('footerStatus');
        this.elements.footerLastUpdate = document.getElementById('footerLastUpdate');
        
        // Overlays
        this.elements.loadingOverlay = document.getElementById('loadingOverlay');
        this.elements.loadingText = document.getElementById('loadingText');
        this.elements.notifications = document.getElementById('notifications');
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Mode toggle
        if (this.elements.modeSwitch) {
            this.elements.modeSwitch.addEventListener('change', (e) => {
                this.toggleApiMode(e.target.checked);
            });
        }
        
        // Initialize form
        if (this.elements.initForm) {
            this.elements.initForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.initializeSystem();
            });
        }
        
        // Manual data forms
        if (this.elements.marketDataForm) {
            this.elements.marketDataForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.updateMarketData();
            });
        }
        
        if (this.elements.positionsForm) {
            this.elements.positionsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.updatePositions();
            });
        }
        
        if (this.elements.analysisForm) {
            this.elements.analysisForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.runAnalysis();
            });
        }
        
        // Refresh buttons
        const refreshSignals = document.getElementById('refreshSignals');
        if (refreshSignals) {
            refreshSignals.addEventListener('click', () => {
                this.refreshSignals();
            });
        }
        
        // API mode input changes
        const apiModeInput = document.getElementById('apiModeInput');
        if (apiModeInput) {
            apiModeInput.addEventListener('change', (e) => {
                this.toggleCredentialsDisplay(e.target.value === 'true');
            });
        }
        
        // Window events
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
        
        window.addEventListener('online', () => {
            console.log('📡 Network online - attempting reconnection');
            this.connectWebSocket();
        });
        
        window.addEventListener('offline', () => {
            console.log('📡 Network offline');
            this.updateConnectionStatus('error', 'Offline');
        });
    }
    
    /**
     * Setup tab functionality
     */
    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tabContainer = e.target.closest('.panel, .section');
                const tabName = e.target.dataset.tab;
                
                if (tabContainer && tabName) {
                    this.switchTab(tabContainer, tabName);
                }
            });
        });
    }
    
    /**
     * Switch tab
     */
    switchTab(container, tabName) {
        // Update buttons
        const buttons = container.querySelectorAll('.tab-btn');
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Update content
        const contents = container.querySelectorAll('.tab-content');
        contents.forEach(content => {
            const shouldShow = content.id === tabName + 'Tab' || 
                             content.id === tabName + 'TabContent' ||
                             content.id === tabName + 'Chart' ||
                             content.id === tabName;
            content.classList.toggle('active', shouldShow);
        });
    }
    
    /**
     * Initialize charts
     */
    initializeCharts() {
        // P&L Chart
        const pnlCanvas = document.getElementById('pnlCanvas');
        if (pnlCanvas) {
            this.charts.pnl = new Chart(pnlCanvas, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'P&L',
                        data: [],
                        borderColor: '#059669',
                        backgroundColor: 'rgba(5, 150, 105, 0.1)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Portfolio P&L Over Time'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            ticks: {
                                callback: function(value) {
                                    return '£' + value.toLocaleString();
                                }
                            }
                        }
                    }
                }
            });
        }
        
        // Greeks Chart
        const greeksCanvas = document.getElementById('greeksChart');
        if (greeksCanvas) {
            this.charts.greeks = new Chart(greeksCanvas, {
                type: 'radar',
                data: {
                    labels: ['Delta', 'Gamma', 'Theta', 'Vega'],
                    datasets: [{
                        label: 'Portfolio Greeks',
                        data: [0, 0, 0, 0],
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.2)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Portfolio Greeks Distribution'
                        }
                    }
                }
            });
        }
        
        // Risk Chart
        const riskCanvas = document.getElementById('riskCanvas');
        if (riskCanvas) {
            this.charts.risk = new Chart(riskCanvas, {
                type: 'doughnut',
                data: {
                    labels: ['Low Risk', 'Medium Risk', 'High Risk'],
                    datasets: [{
                        data: [70, 20, 10],
                        backgroundColor: ['#059669', '#d97706', '#dc2626']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Risk Distribution'
                        }
                    }
                }
            });
        }
        
        // BP Chart
        const bpCanvas = document.getElementById('bpCanvas');
        if (bpCanvas) {
            this.charts.bp = new Chart(bpCanvas, {
                type: 'bar',
                data: {
                    labels: ['Used', 'Available'],
                    datasets: [{
                        label: 'Buying Power',
                        data: [30, 70],
                        backgroundColor: ['#2563eb', '#e5e7eb']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Buying Power Usage'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                }
                            }
                        }
                    }
                }
            });
        }
    }
    
    /**
     * Connect WebSocket
     */
    connectWebSocket() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('📡 WebSocket already connected');
            return;
        }
        
        console.log(`📡 Connecting to WebSocket: ${this.config.wsUrl}`);
        this.updateConnectionStatus('connecting', 'Connecting...');
        
        try {
            this.ws = new WebSocket(this.config.wsUrl);
            
            this.ws.onopen = (event) => {
                console.log('📡 WebSocket connected');
                this.wsReconnectAttempts = 0;
                this.isConnected = true;
                this.updateConnectionStatus('connected', 'Connected');
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('🚨 WebSocket message parse error:', error);
                }
            };
            
            this.ws.onclose = (event) => {
                console.log('📡 WebSocket disconnected:', event.code, event.reason);
                this.isConnected = false;
                this.updateConnectionStatus('error', 'Disconnected');
                
                // Attempt reconnection
                if (this.wsReconnectAttempts < this.config.reconnectAttempts) {
                    this.wsReconnectAttempts++;
                    console.log(`📡 Reconnecting... attempt ${this.wsReconnectAttempts}`);
                    setTimeout(() => this.connectWebSocket(), this.config.reconnectDelay);
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('🚨 WebSocket error:', error);
                this.updateConnectionStatus('error', 'Connection Error');
            };
            
        } catch (error) {
            console.error('🚨 WebSocket connection failed:', error);
            this.updateConnectionStatus('error', 'Failed to connect');
        }
    }
    
    /**
     * Handle WebSocket messages
     */
    handleWebSocketMessage(data) {
        console.log('📡 WebSocket message:', data.type);
        
        switch (data.type) {
            case 'welcome':
                console.log('👋 Welcome message received');
                if (data.data.initialized) {
                    this.isInitialized = true;
                    this.hideInitPanel();
                }
                break;
                
            case 'system_status':
                this.updateSystemStatus(data.data);
                break;
                
            case 'analysis_complete':
            case 'scheduled_analysis':
                this.handleAnalysisComplete(data.data);
                break;
                
            case 'signal':
                this.handleNewSignal(data.data);
                break;
                
            case 'active_signals':
                this.updateSignals(data.data);
                break;
                
            case 'analysis_data':
                this.currentAnalysis = data.data;
                this.updateAnalysisDisplay();
                break;
                
            case 'market_data_updated':
                this.showNotification('Market data updated', 'success');
                break;
                
            case 'positions_updated':
                this.showNotification(`${data.data.count} positions updated`, 'success');
                break;
                
            case 'scheduler_error':
                this.showNotification('Scheduled analysis error: ' + data.data.error, 'error');
                break;
                
            case 'error':
                this.showNotification(data.data.error, 'error');
                break;
                
            case 'pong':
                // Heartbeat response
                break;
                
            default:
                console.log('📡 Unknown message type:', data.type);
        }
    }
    
    /**
     * Send WebSocket message
     */
    sendWebSocketMessage(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.warn('📡 WebSocket not connected');
        }
    }
    
    /**
     * Update connection status
     */
    updateConnectionStatus(status, text) {
        if (this.elements.statusIndicator) {
            this.elements.statusIndicator.className = `status-indicator ${status}`;
        }
        
        if (this.elements.statusText) {
            this.elements.statusText.textContent = text;
        }
    }
    
    /**
     * Initialize system
     */
    async initializeSystem() {
        const formData = new FormData(this.elements.initForm);
        const data = {
            apiMode: formData.get('apiMode') === 'true',
            phase: parseInt(formData.get('phase')),
            accountValue: parseInt(formData.get('accountValue'))
        };
        
        console.log('🚀 Initializing system with:', data);
        this.showLoading('Initializing system...');
        
        try {
            const response = await fetch(`${this.config.apiUrl}/api/initialize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.isInitialized = true;
                this.hideInitPanel();
                this.showNotification('System initialized successfully', 'success');
                this.updateSystemStatus(result.result);
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('🚨 Initialize error:', error);
            this.showNotification('Initialization failed: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    /**
     * Run analysis
     */
    async runAnalysis() {
        const formData = new FormData(this.elements.analysisForm);
        const data = {};
        
        if (formData.get('vixLevel')) data.vixLevel = parseFloat(formData.get('vixLevel'));
        if (formData.get('phase')) data.phase = parseInt(formData.get('phase'));
        
        console.log('🧠 Running analysis with:', data);
        this.showLoading('Running comprehensive analysis...');
        
        try {
            const response = await fetch(`${this.config.apiUrl}/api/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.handleAnalysisComplete(result);
                this.showNotification('Analysis completed successfully', 'success');
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('🚨 Analysis error:', error);
            this.showNotification('Analysis failed: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    /**
     * Update market data
     */
    async updateMarketData() {
        const formData = new FormData(this.elements.marketDataForm);
        let marketData;
        
        try {
            const jsonText = formData.get('marketData');
            if (jsonText) {
                marketData = JSON.parse(jsonText);
            } else {
                // Build from individual fields
                marketData = {};
                if (formData.get('vixLevel')) {
                    marketData.VIX = { currentLevel: parseFloat(formData.get('vixLevel')) };
                }
            }
            
            const response = await fetch(`${this.config.apiUrl}/api/market-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ marketData })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Market data updated', 'success');
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('🚨 Market data error:', error);
            this.showNotification('Market data update failed: ' + error.message, 'error');
        }
    }
    
    /**
     * Update positions
     */
    async updatePositions() {
        const formData = new FormData(this.elements.positionsForm);
        
        try {
            const positions = JSON.parse(formData.get('positions'));
            
            const response = await fetch(`${this.config.apiUrl}/api/positions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ positions })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification(`${result.count} positions updated`, 'success');
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('🚨 Positions error:', error);
            this.showNotification('Positions update failed: ' + error.message, 'error');
        }
    }
    
    /**
     * Refresh signals
     */
    async refreshSignals() {
        this.sendWebSocketMessage({ type: 'request_signals' });
    }
    
    /**
     * Handle analysis complete
     */
    handleAnalysisComplete(data) {
        console.log('✅ Analysis complete');
        this.currentAnalysis = data.analysis || data;
        this.updateAnalysisDisplay();
        this.updateSignals(data.signals || []);
        this.updateLastUpdate();
    }
    
    /**
     * Handle new signal
     */
    handleNewSignal(signal) {
        console.log('🎯 New signal:', signal.type, signal.ticker);
        
        // Add to active signals
        this.activeSignals.push(signal);
        
        // Update display
        this.updateSignals(this.activeSignals);
        
        // Show notification for high priority signals
        if (['URGENT', 'HIGH'].includes(signal.priority)) {
            this.showNotification(
                `${signal.priority} Signal: ${signal.ticker} ${signal.strategy}`,
                'warning'
            );
        }
    }
    
    /**
     * Update system status
     */
    updateSystemStatus(status) {
        if (this.elements.accountPhase) {
            this.elements.accountPhase.textContent = `Phase ${status.phase || 1}`;
            this.elements.accountPhase.className = `value phase-${status.phase || 1}`;
        }
        
        if (this.elements.accountValue && status.accountValue) {
            this.elements.accountValue.textContent = `£${status.accountValue.toLocaleString()}`;
        }
        
        if (this.elements.positionCount) {
            this.elements.positionCount.textContent = status.positionCount || 0;
        }
        
        if (this.elements.lastUpdate && status.lastUpdate) {
            this.elements.lastUpdate.textContent = this.formatTimestamp(status.lastUpdate);
        }
        
        // Update footer
        if (this.elements.footerStatus) {
            this.elements.footerStatus.textContent = status.mode || 'System Ready';
        }
        
        this.updateLastUpdate();
    }
    
    /**
     * Update analysis display
     */
    updateAnalysisDisplay() {
        if (!this.currentAnalysis) return;
        
        const analysis = this.currentAnalysis;
        
        // Update status values
        if (this.elements.bpUsage && analysis.positions?.bpUsage) {
            this.elements.bpUsage.textContent = `${analysis.positions.bpUsage.totalBP}%`;
        }
        
        if (this.elements.riskLevel && analysis.risk?.overallRisk) {
            this.elements.riskLevel.textContent = analysis.risk.overallRisk.level;
            this.elements.riskLevel.className = `value risk-${analysis.risk.overallRisk.level.toLowerCase()}`;
        }
        
        if (this.elements.vixRegime && analysis.risk?.vixAnalysis) {
            this.elements.vixRegime.textContent = analysis.risk.vixAnalysis.regime;
        }
        
        // Update Greeks
        if (analysis.positions?.health) {
            const totals = this.calculateTotalGreeks(analysis.positions.health);
            if (this.elements.netDelta) this.elements.netDelta.textContent = totals.delta.toFixed(2);
            if (this.elements.netGamma) this.elements.netGamma.textContent = totals.gamma.toFixed(2);
            if (this.elements.netTheta) this.elements.netTheta.textContent = totals.theta.toFixed(2);
            if (this.elements.netVega) this.elements.netVega.textContent = totals.vega.toFixed(2);
            
            // Update Greeks chart
            if (this.charts.greeks) {
                this.charts.greeks.data.datasets[0].data = [
                    Math.abs(totals.delta),
                    Math.abs(totals.gamma),
                    Math.abs(totals.theta),
                    Math.abs(totals.vega)
                ];
                this.charts.greeks.update();
            }
        }
        
        // Update patterns
        if (analysis.patterns && this.elements.patternsResults) {
            this.updatePatternsDisplay(analysis.patterns);
        }
        
        // Update positions
        if (analysis.positions?.health) {
            this.updatePositionsDisplay(analysis.positions.health);
        }
        
        // Update correlation groups
        if (analysis.risk?.correlationStatus && this.elements.correlationGroups) {
            this.updateCorrelationDisplay(analysis.risk.correlationStatus);
        }
        
        // Update VIX analysis
        if (analysis.risk?.vixAnalysis && this.elements.vixAnalysis) {
            this.updateVixDisplay(analysis.risk.vixAnalysis);
        }
        
        // Update BP chart
        if (this.charts.bp && analysis.positions?.bpUsage) {
            const used = analysis.positions.bpUsage.totalBP;
            this.charts.bp.data.datasets[0].data = [used, 100 - used];
            this.charts.bp.update();
        }
    }
    
    /**
     * Update signals display
     */
    updateSignals(signals) {
        this.activeSignals = Array.isArray(signals) ? signals : [];
        
        // Update signal stats
        const entryCount = this.activeSignals.filter(s => s.type === 'ENTRY_SIGNAL').length;
        const exitCount = this.activeSignals.filter(s => s.type === 'EXIT_SIGNAL').length;
        const riskCount = this.activeSignals.filter(s => s.type === 'RISK_ALERT').length;
        
        if (this.elements.entrySignals) this.elements.entrySignals.textContent = entryCount;
        if (this.elements.exitSignals) this.elements.exitSignals.textContent = exitCount;
        if (this.elements.riskSignals) this.elements.riskSignals.textContent = riskCount;
        if (this.elements.activeSignals) this.elements.activeSignals.textContent = this.activeSignals.length;
        
        // Update signals list
        if (this.elements.signalsList) {
            if (this.activeSignals.length === 0) {
                this.elements.signalsList.innerHTML = `
                    <div class="empty-state">
                        <p>🔍 No active signals</p>
                        <p class="subtitle">Signals will appear here when generated</p>
                    </div>
                `;
            } else {
                this.elements.signalsList.innerHTML = this.activeSignals
                    .slice(0, 10) // Show top 10
                    .map(signal => this.renderSignal(signal))
                    .join('');
            }
        }
    }
    
    /**
     * Render signal HTML
     */
    renderSignal(signal) {
        const typeIcon = {
            'ENTRY_SIGNAL': '📈',
            'EXIT_SIGNAL': '📉',
            'RISK_ALERT': '⚠️',
            'ADJUSTMENT_SIGNAL': '🔧',
            'VIX_OPPORTUNITY': '🎯',
            'TIME_SENSITIVE': '⏰'
        };
        
        return `
            <div class="signal-item">
                <div class="signal-header">
                    <div>
                        <div class="signal-title">
                            ${typeIcon[signal.type] || '📊'} ${signal.ticker || ''} ${signal.strategy || ''}
                        </div>
                        <div class="signal-details">
                            ${signal.reasoning || signal.alert?.message || 'No details available'}
                        </div>
                    </div>
                    <div class="signal-priority priority-${signal.priority.toLowerCase()}">
                        ${signal.priority}
                    </div>
                </div>
                ${signal.expectedReturn ? `<div class="signal-details">Expected Return: ${signal.expectedReturn}%</div>` : ''}
                ${signal.validUntil ? `<div class="signal-details">Valid until: ${this.formatTimestamp(signal.validUntil)}</div>` : ''}
            </div>
        `;
    }
    
    /**
     * Update patterns display
     */
    updatePatternsDisplay(patterns) {
        const patternEntries = Object.entries(patterns);
        
        if (patternEntries.length === 0) {
            this.elements.patternsResults.innerHTML = `
                <div class="empty-state">
                    <p>🔍 No pattern analysis</p>
                    <p class="subtitle">Run analysis to see pattern results</p>
                </div>
            `;
            return;
        }
        
        this.elements.patternsResults.innerHTML = patternEntries
            .map(([ticker, pattern]) => `
                <div class="pattern-item">
                    <div class="pattern-header">
                        <span class="pattern-ticker">${ticker}</span>
                        <span class="pattern-quality quality-${pattern.quality.toLowerCase()}">${pattern.quality}</span>
                        <span class="pattern-score">${pattern.score}/100</span>
                    </div>
                    <div class="pattern-details">
                        ${pattern.recommendations.slice(0, 2).join('. ')}
                    </div>
                </div>
            `)
            .join('');
    }
    
    /**
     * Update positions display
     */
    updatePositionsDisplay(positions) {
        if (!positions || positions.length === 0) {
            this.elements.positionsList.innerHTML = `
                <div class="empty-state">
                    <p>📋 No positions</p>
                    <p class="subtitle">Positions will appear here when loaded</p>
                </div>
            `;
            return;
        }
        
        // Update position stats
        const profitableCount = positions.filter(p => (p.unrealizedPnL || 0) > 0).length;
        const riskCount = positions.filter(p => p.exitTrigger).length;
        
        if (this.elements.totalPositions) this.elements.totalPositions.textContent = positions.length;
        if (this.elements.profitablePositions) this.elements.profitablePositions.textContent = profitableCount;
        if (this.elements.riskPositions) this.elements.riskPositions.textContent = riskCount;
        
        // Render positions
        this.elements.positionsList.innerHTML = positions
            .slice(0, 10)
            .map(position => this.renderPosition(position))
            .join('');
    }
    
    /**
     * Render position HTML
     */
    renderPosition(position) {
        const pnlClass = (position.unrealizedPnL || 0) >= 0 ? 'pnl-profit' : 'pnl-loss';
        const pnlText = (position.unrealizedPnL || 0) >= 0 ? '+' : '';
        
        return `
            <div class="position-item">
                <div class="position-header">
                    <span class="position-symbol">${position.ticker} ${position.strategy}</span>
                    <span class="position-pnl ${pnlClass}">
                        ${pnlText}£${(position.unrealizedPnL || 0).toLocaleString()}
                    </span>
                </div>
                <div class="position-details">
                    <div>DTE: ${position.dte || 'N/A'}</div>
                    <div>Qty: ${position.quantity || 'N/A'}</div>
                    <div>Health: ${position.healthScore || 'N/A'}/100</div>
                    ${position.exitTrigger ? '<div style="color: var(--danger-color)">Exit Required</div>' : ''}
                </div>
            </div>
        `;
    }
    
    /**
     * Update correlation display
     */
    updateCorrelationDisplay(correlationStatus) {
        if (!correlationStatus.groups) return;
        
        this.elements.correlationGroups.innerHTML = Object.entries(correlationStatus.groups)
            .map(([group, data]) => {
                const violatedClass = data.count > data.limit ? 'correlation-violated' : '';
                return `
                    <div class="correlation-group ${violatedClass}">
                        ${group}: ${data.count}/${data.limit}
                    </div>
                `;
            })
            .join('');
    }
    
    /**
     * Update VIX display
     */
    updateVixDisplay(vixAnalysis) {
        this.elements.vixAnalysis.innerHTML = `
            <div><strong>Regime:</strong> ${vixAnalysis.regime}</div>
            <div><strong>Level:</strong> ${vixAnalysis.vixLevel}</div>
            <div><strong>Opportunity:</strong> ${vixAnalysis.recommendations[0] || 'Standard trading'}</div>
        `;
    }
    
    /**
     * Calculate total Greeks
     */
    calculateTotalGreeks(positions) {
        return positions.reduce((totals, pos) => ({
            delta: totals.delta + (pos.netDelta || 0),
            gamma: totals.gamma + (pos.netGamma || 0),
            theta: totals.theta + (pos.dailyTheta || 0),
            vega: totals.vega + (pos.netVega || 0)
        }), { delta: 0, gamma: 0, theta: 0, vega: 0 });
    }
    
    /**
     * Toggle API mode display
     */
    toggleApiMode(isApi) {
        if (this.elements.manualPanel) {
            this.elements.manualPanel.style.display = isApi ? 'none' : 'block';
        }
    }
    
    /**
     * Toggle credentials display
     */
    toggleCredentialsDisplay(show) {
        const credentials = document.getElementById('apiCredentials');
        if (credentials) {
            credentials.style.display = show ? 'block' : 'none';
        }
    }
    
    /**
     * Hide initialization panel
     */
    hideInitPanel() {
        if (this.elements.initPanel) {
            this.elements.initPanel.style.display = 'none';
        }
    }
    
    /**
     * Show loading overlay
     */
    showLoading(text = 'Loading...') {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.style.display = 'flex';
        }
        if (this.elements.loadingText) {
            this.elements.loadingText.textContent = text;
        }
    }
    
    /**
     * Hide loading overlay
     */
    hideLoading() {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.style.display = 'none';
        }
    }
    
    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        if (this.elements.notifications) {
            this.elements.notifications.appendChild(notification);
        }
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
        
        console.log(`📢 Notification (${type}):`, message);
    }
    
    /**
     * Update last update timestamp
     */
    updateLastUpdate() {
        const now = new Date().toLocaleTimeString();
        if (this.elements.lastUpdate) {
            this.elements.lastUpdate.textContent = now;
        }
        if (this.elements.footerLastUpdate) {
            this.elements.footerLastUpdate.textContent = now;
        }
    }
    
    /**
     * Format timestamp
     */
    formatTimestamp(timestamp) {
        try {
            return new Date(timestamp).toLocaleString();
        } catch {
            return 'Invalid date';
        }
    }
    
    /**
     * Start heartbeat
     */
    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            this.sendWebSocketMessage({ type: 'ping' });
        }, this.config.heartbeatInterval);
    }
    
    /**
     * Cleanup
     */
    cleanup() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
        
        if (this.ws) {
            this.ws.close();
        }
        
        // Destroy charts
        Object.values(this.charts).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });
    }
}

// Initialize dashboard when page loads
window.dashboard = new TomKingDashboard();