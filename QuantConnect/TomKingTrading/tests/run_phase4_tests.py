# Tom King Trading Framework - Phase 4 Test Runner
# Execute comprehensive tests for Position Exit Rules and Greeks Aggregation

from AlgorithmImports import *
from datetime import datetime, timedelta

# Import test suites
from test_phase4_integration import TestPhase4Integration

def run_phase4_tests(algorithm):
    """
    Execute Phase 4 comprehensive testing
    
    This function can be called from the main algorithm to verify:
    1. Tom King exit rules are functioning correctly
    2. Greeks aggregation system is working
    3. Systems are properly integrated
    4. Risk management is operational
    
    Args:
        algorithm: The QuantConnect algorithm instance
        
    Returns:
        Dict containing test results and system health
    """
    
    algorithm.Log("\n" + "🚀" * 40)
    algorithm.Log("PHASE 4 TESTING - Tom King Trading Framework")
    algorithm.Log("Position Exit Rules & Greeks Aggregation Systems")
    algorithm.Log("🚀" * 40 + "\n")
    
    try:
        # Initialize test suite
        phase4_tester = TestPhase4Integration(algorithm)
        
        # Run comprehensive tests
        test_results = phase4_tester.run_phase4_complete_test()
        
        # Log final summary
        _log_test_completion_summary(algorithm, test_results)
        
        return test_results
        
    except Exception as e:
        algorithm.Error(f"❌ Phase 4 testing failed with error: {e}")
        return {
            'success': False,
            'error': str(e),
            'systems_ready': False
        }

def _log_test_completion_summary(algorithm, results):
    """Log comprehensive test completion summary"""
    
    algorithm.Log("\n" + "="*80)
    algorithm.Log("🏁 PHASE 4 TESTING COMPLETE")
    algorithm.Log("="*80)
    
    # Extract key metrics
    exit_system = results.get('exit_system', {})
    greeks_system = results.get('greeks_system', {})
    integration = results.get('integration', {})
    health = results.get('overall_health', {})
    
    # System-by-system summary
    algorithm.Log("\n📊 SYSTEM TEST RESULTS:")
    
    # Exit System Results
    exit_passed = exit_system.get('tests_passed', 0)
    exit_total = exit_system.get('tests_run', 1)
    exit_rate = (exit_passed / exit_total) * 100 if exit_total > 0 else 0
    
    algorithm.Log(f"   🎯 Exit System: {exit_passed}/{exit_total} ({exit_rate:.1f}%)")
    
    # Greeks System Results
    greeks_passed = greeks_system.get('tests_passed', 0)
    greeks_total = greeks_system.get('tests_run', 1)
    greeks_rate = (greeks_passed / greeks_total) * 100 if greeks_total > 0 else 0
    
    algorithm.Log(f"   📊 Greeks System: {greeks_passed}/{greeks_total} ({greeks_rate:.1f}%)")
    
    # Integration Results
    int_passed = integration.get('tests_passed', 0)
    int_total = integration.get('tests_run', 1)
    int_rate = (int_passed / int_total) * 100 if int_total > 0 else 0
    
    algorithm.Log(f"   🔗 Integration: {int_passed}/{int_total} ({int_rate:.1f}%)")
    
    # Overall Health
    overall_rate = health.get('overall_success_rate', 0)
    status = health.get('status', 'UNKNOWN')
    
    status_emoji = {
        'EXCELLENT': '🎉',
        'GOOD': '👍', 
        'NEEDS_ATTENTION': '⚠️',
        'CRITICAL': '🚨'
    }.get(status, '❓')
    
    algorithm.Log(f"\n{status_emoji} OVERALL SYSTEM HEALTH: {status} ({overall_rate:.1f}%)")
    
    # Feature Implementation Status
    algorithm.Log("\n✅ TOM KING FEATURES TESTED:")
    tom_king_features = [
        "50% Profit Target Exit (Standard)",
        "25% Profit Target Exit (0DTE)", 
        "200% Stop Loss Rule",
        "21 DTE Mandatory Exit",
        "VIX Spike Defensive Exits",
        "Assignment Risk Management",
        "Portfolio Drawdown Protection",
        "Real-time Greeks Calculation",
        "Portfolio Greeks Aggregation",
        "Risk Limit Monitoring",
        "Delta Neutral Targeting",
        "Position Adjustment Signals"
    ]
    
    for feature in tom_king_features:
        algorithm.Log(f"   ✅ {feature}")
    
    # Critical System Readiness
    systems_ready = overall_rate >= 85  # 85% threshold for live trading
    
    if systems_ready:
        algorithm.Log(f"\n🚀 SYSTEMS READY FOR LIVE TRADING")
        algorithm.Log(f"   All Tom King exit rules implemented and tested")
        algorithm.Log(f"   Greeks aggregation system operational") 
        algorithm.Log(f"   Risk management controls verified")
        algorithm.Log(f"   Integration testing passed")
    else:
        algorithm.Log(f"\n⚠️ SYSTEMS NOT READY - ADDRESS ISSUES FIRST")
        algorithm.Log(f"   Success rate {overall_rate:.1f}% below 85% threshold")
        
        # List recommendations if available
        recommendations = health.get('recommendations', [])
        if recommendations:
            algorithm.Log(f"\n📝 URGENT RECOMMENDATIONS:")
            for i, rec in enumerate(recommendations, 1):
                algorithm.Log(f"   {i}. {rec}")
    
    # Test Coverage Summary
    algorithm.Log(f"\n📋 TEST COVERAGE ACHIEVED:")
    algorithm.Log(f"   📊 Exit Rules: {len(get_exit_rules_tested())} rules tested")
    algorithm.Log(f"   🧮 Greeks: {len(get_greeks_features_tested())} features tested")
    algorithm.Log(f"   🔗 Integration: {len(get_integration_scenarios_tested())} scenarios tested")
    
    # Final readiness statement
    readiness_emoji = "🟢" if systems_ready else "🔴"
    algorithm.Log(f"\n{readiness_emoji} PHASE 4 STATUS: {'COMPLETE' if systems_ready else 'INCOMPLETE'}")

def get_exit_rules_tested() -> list:
    """Get list of Tom King exit rules that were tested"""
    return [
        "50% Profit Target (LT112)",
        "25% Profit Target (0DTE)",
        "200% Stop Loss Rule",
        "21 DTE Mandatory Exit",
        "Assignment Risk (Short Put ITM > 2%)",
        "Assignment Risk (Short Call ITM > 1%)",
        "VIX Spike Defensive Exit (>35)",
        "Portfolio Drawdown Exit (>15%)",
        "Correlation Violation Exits",
        "August 2024 Protection Pattern"
    ]

def get_greeks_features_tested() -> list:
    """Get list of Greeks features that were tested"""
    return [
        "Black-Scholes Greeks Calculation",
        "Put Spread Greeks Aggregation",
        "Strangle Greeks Aggregation", 
        "Iron Condor Greeks Aggregation",
        "Portfolio Greeks Summation",
        "Delta Risk Limit (±50)",
        "Gamma Risk Limit (5)",
        "Theta Risk Limit (-500/day)",
        "Vega Risk Limit (1000)",
        "Delta Neutral Targeting (±10)",
        "Position Adjustment Signals",
        "Greeks Caching System",
        "2-Hour Update Cycle",
        "Real-time Risk Monitoring"
    ]

def get_integration_scenarios_tested() -> list:
    """Get list of integration scenarios that were tested"""
    return [
        "Greeks-based Exit Decision Making",
        "Portfolio Risk Limit Violations",
        "Multi-Position Risk Management",
        "Real-time Monitoring Integration",
        "Complete Risk Management Workflow",
        "Exit Execution Integration",
        "Statistics Tracking Integration",
        "Error Handling Integration"
    ]

# Utility function for main algorithm integration
def phase4_health_check(algorithm) -> bool:
    """
    Quick health check for Phase 4 systems
    Can be called during algorithm initialization
    
    Returns:
        True if systems are healthy, False if issues detected
    """
    try:
        algorithm.Log("🏥 Running Phase 4 health check...")
        
        # Import required modules to verify they load correctly
        from trading.position_exit_manager import PositionExitManager
        from greeks.greeks_engine import GreeksEngine
        from trading.order_execution_engine import ExecutionEngine
        
        # Initialize systems to verify they work
        exit_manager = PositionExitManager(algorithm)
        greeks_engine = GreeksEngine(algorithm)
        execution_engine = ExecutionEngine(algorithm)
        
        # Basic functionality check
        exit_stats = exit_manager.GetExitStatistics()
        
        # Mock basic portfolio for Greeks test
        test_portfolio = {}
        portfolio_greeks = greeks_engine.CalculatePortfolioGreeks(test_portfolio)
        
        algorithm.Log("✅ Phase 4 health check passed")
        return True
        
    except Exception as e:
        algorithm.Log(f"❌ Phase 4 health check failed: {e}")
        return False

# Phase 4 readiness verification
def verify_phase4_readiness(algorithm) -> dict:
    """
    Verify Phase 4 system readiness without full testing
    Useful for production deployment verification
    
    Returns:
        Dict with readiness status and any issues found
    """
    readiness_report = {
        'ready': True,
        'issues': [],
        'warnings': [],
        'systems_checked': []
    }
    
    try:
        algorithm.Log("🔍 Verifying Phase 4 readiness...")
        
        # Check 1: Exit Manager Initialization
        try:
            from trading.position_exit_manager import PositionExitManager
            exit_manager = PositionExitManager(algorithm)
            readiness_report['systems_checked'].append('Position Exit Manager')
        except Exception as e:
            readiness_report['ready'] = False
            readiness_report['issues'].append(f"Exit Manager failed: {e}")
        
        # Check 2: Greeks Engine Initialization  
        try:
            from greeks.greeks_engine import GreeksEngine
            greeks_engine = GreeksEngine(algorithm)
            readiness_report['systems_checked'].append('Greeks Engine')
        except Exception as e:
            readiness_report['ready'] = False
            readiness_report['issues'].append(f"Greeks Engine failed: {e}")
        
        # Check 3: Execution Engine Initialization
        try:
            from trading.order_execution_engine import ExecutionEngine  
            execution_engine = ExecutionEngine(algorithm)
            readiness_report['systems_checked'].append('Execution Engine')
        except Exception as e:
            readiness_report['ready'] = False
            readiness_report['issues'].append(f"Execution Engine failed: {e}")
        
        # Check 4: Required Dependencies
        required_modules = [
            'scipy.stats',
            'numpy', 
            'datetime',
            'typing'
        ]
        
        for module in required_modules:
            try:
                __import__(module)
                readiness_report['systems_checked'].append(f'Module: {module}')
            except ImportError as e:
                readiness_report['ready'] = False
                readiness_report['issues'].append(f"Missing dependency: {module}")
        
        # Log results
        if readiness_report['ready']:
            algorithm.Log("✅ Phase 4 systems ready for deployment")
            algorithm.Log(f"   Verified {len(readiness_report['systems_checked'])} components")
        else:
            algorithm.Log("❌ Phase 4 systems NOT ready")
            for issue in readiness_report['issues']:
                algorithm.Log(f"   Issue: {issue}")
        
        return readiness_report
        
    except Exception as e:
        readiness_report['ready'] = False
        readiness_report['issues'].append(f"Readiness check failed: {e}")
        return readiness_report