#!/usr/bin/env node
/**
 * TomKingTrader Application Startup Script
 * Loads environment variables and starts the complete trading system
 */

// Load environment variables
require('dotenv').config();

// Import the application server
const { createApp } = require('./src/app');

/**
 * Start the TomKingTrader application with proper error handling
 */
async function startApplication() {
    try {
        console.log('🚀 Starting TomKingTrader Application...');
        console.log('📊 Tom King Systematic Trading Framework v17');
        console.log('🎯 Goal: £30k → £100k in 18 months');
        console.log('');
        
        // Configuration summary
        const config = {
            port: process.env.PORT || 3000,
            wsPort: process.env.WS_PORT || 3001,
            environment: process.env.NODE_ENV || 'development',
            apiMode: process.env.TASTY_CLIENT_ID ? 'Available' : 'Manual Only',
            scheduler: process.env.ENABLE_SCHEDULER !== 'false',
            maxBP: process.env.MAX_BP_USAGE || 50,
            logLevel: process.env.LOG_LEVEL || 'info'
        };
        
        console.log('⚙️  Configuration:');
        console.log(`   HTTP Port: ${config.port}`);
        console.log(`   WebSocket Port: ${config.wsPort}`);
        console.log(`   Environment: ${config.environment}`);
        console.log(`   API Mode: ${config.apiMode}`);
        console.log(`   Scheduler: ${config.scheduler ? 'Enabled' : 'Disabled'}`);
        console.log(`   Max BP Usage: ${config.maxBP}%`);
        console.log(`   Log Level: ${config.logLevel}`);
        console.log('');
        
        // Start the application
        const app = await createApp({
            port: config.port,
            wsPort: config.wsPort,
            environment: config.environment,
            enableScheduler: config.scheduler,
            logLevel: config.logLevel
        });
        
        console.log('');
        console.log('✅ TomKingTrader started successfully!');
        console.log(`📊 Dashboard: http://localhost:${config.port}`);
        console.log(`📡 WebSocket: ws://localhost:${config.wsPort}`);
        console.log('');
        console.log('🎯 System Features:');
        console.log('   • Real-time TastyTrade API integration');
        console.log('   • Advanced pattern analysis engine (2000+ lines)');
        console.log('   • Tom King proven strategies (0DTE, LT112, Strangles)');
        console.log('   • Comprehensive risk management');
        console.log('   • Progressive account phases (£30k-£100k)');
        console.log('   • August 5, 2024 disaster prevention');
        console.log('   • Real-time WebSocket dashboard');
        console.log('');
        console.log('📋 Quick Start:');
        console.log('   1. Open browser and navigate to dashboard');
        console.log('   2. Initialize system with account details');
        console.log('   3. Choose API mode (with credentials) or Manual mode');
        console.log('   4. Run analysis to generate signals');
        console.log('');
        
        return app;
        
    } catch (error) {
        console.error('🚨 Failed to start TomKingTrader:', error.message);
        console.error('');
        console.error('🔧 Troubleshooting:');
        console.error('   • Check .env file configuration');
        console.error('   • Verify all dependencies are installed (npm install)');
        console.error('   • Check port availability');
        console.error('   • Review log files for detailed errors');
        console.error('');
        
        process.exit(1);
    }
}

// Start the application if this file is run directly
if (require.main === module) {
    startApplication().catch(error => {
        console.error('🚨 Startup failed:', error);
        process.exit(1);
    });
}

module.exports = startApplication;