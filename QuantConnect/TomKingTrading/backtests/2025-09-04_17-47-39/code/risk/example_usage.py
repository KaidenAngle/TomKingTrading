"""
Example Usage of QuantConnect LEAN Risk Management Modules
Demonstrates how to use the Tom King risk management system
"""

from risk import (
    PositionSizer, 
    CorrelationManager, 
    DefensiveManager,
    get_risk_parameters,
    get_vix_regime_info,
    check_emergency_status
)

def example_position_sizing():
    """Example: VIX-based position sizing"""
    print("=== POSITION SIZING EXAMPLE ===")
    
    sizer = PositionSizer()
    
    # Example account details
    account_value = 50000  # £50k account (Phase 2)
    vix_level = 22.5       # Current VIX level
    
    # Get maximum BP usage based on VIX and phase
    bp_analysis = sizer.calculate_max_bp_usage(vix_level, account_value)
    print(f"Account: £{account_value:,}")
    print(f"VIX Level: {vix_level}")
    print(f"VIX Regime: {bp_analysis['vix_regime']}")
    print(f"Account Phase: {bp_analysis['account_phase']}")
    print(f"Max BP Usage: {bp_analysis['max_bp_usage']:.1%}")
    print(f"Max Positions: {bp_analysis['max_positions']}")
    print(f"Deployment Strategy: {bp_analysis['deployment_strategy']}")
    
    # Calculate position size for specific strategy
    strategy_sizing = sizer.calculate_position_size('STRANGLE', account_value, vix_level)
    print(f"\nSTRANGLE Strategy Sizing:")
    print(f"Recommended Positions: {strategy_sizing['recommended_positions']}")
    print(f"BP per Position: {strategy_sizing['bp_per_position']:.1%}")
    print(f"Total BP Usage: {strategy_sizing['total_bp_usage']:.1%}")
    print(f"Kelly Fraction: {strategy_sizing['kelly_fraction']:.3f}")
    
    print("\n" + "="*50 + "\n")

def example_correlation_management():
    """Example: Correlation group management"""
    print("=== CORRELATION MANAGEMENT EXAMPLE ===")
    
    corr_manager = CorrelationManager()
    
    # Example current positions
    current_positions = [
        {'symbol': 'SPY', 'strategy': 'LT112'},
        {'symbol': 'QQQ', 'strategy': 'STRANGLE'},
        {'symbol': 'ES', 'strategy': '0DTE'}
    ]
    
    # Check if we can add another equity position
    new_symbol = 'IWM'
    account_phase = 2
    vix_level = 22.5
    
    limit_check = corr_manager.check_position_limits(current_positions, new_symbol, account_phase, vix_level)
    
    print(f"Current Positions: {[p['symbol'] for p in current_positions]}")
    print(f"Trying to add: {new_symbol}")
    print(f"Can add position: {limit_check['can_add_position']}")
    print(f"Correlation group: {limit_check['correlation_group']}")
    print(f"Current in group: {limit_check['current_positions_in_group']}")
    print(f"Max per group: {limit_check['max_positions_per_group']}")
    print(f"Diversification score: {limit_check['diversification_score']:.2f}")
    
    # Monitor portfolio correlation risk
    risk_analysis = corr_manager.monitor_correlation_risk(current_positions, vix_level)
    print(f"\nPortfolio Risk Analysis:")
    print(f"Total positions: {risk_analysis['portfolio_analysis']['total_positions']}")
    print(f"Group distribution: {risk_analysis['portfolio_analysis']['group_distribution']}")
    print(f"August 2024 risk: {risk_analysis['disaster_scenario_risk']['risk_level']}")
    
    if risk_analysis['alerts']:
        print("ALERTS:")
        for alert in risk_analysis['alerts']:
            print(f"- {alert['type']}: {alert['message']}")
    
    print("\n" + "="*50 + "\n")

def example_defensive_management():
    """Example: Defensive position management"""
    print("=== DEFENSIVE MANAGEMENT EXAMPLE ===")
    
    defensive_manager = DefensiveManager()
    
    # Example position that needs management
    from datetime import datetime, timedelta
    
    position = {
        'id': 'POS_001',
        'strategy': '0DTE',
        'symbol': 'SPY',
        'entry_date': datetime.now() - timedelta(hours=2),
        'expiration_date': datetime.now() + timedelta(hours=6),  # Expires today
        'entry_price': 2.50,
        'current_price': 1.25,  # 50% profit
        'delta': 0.15,
        'quantity': 2
    }
    
    market_data = {
        'underlying_price': 450.25,
        'vix': 18.5
    }
    
    # Analyze position health
    analysis = defensive_manager.analyze_position_health(position, market_data)
    
    print(f"Position: {position['strategy']} {position['symbol']}")
    print(f"Status: {analysis['status']}")
    print(f"Urgency: {analysis['urgency']}")
    print(f"P&L: {analysis['metrics']['pnl_percent']:.1%}")
    print(f"DTE: {analysis['metrics']['dte']}")
    
    if analysis['recommended_actions']:
        print("\nRecommended Actions:")
        for action in analysis['recommended_actions']:
            print(f"- {action['action']}: {action['reason']}")
    
    # Portfolio-wide analysis
    portfolio = [position]  # Simplified single position
    portfolio_analysis = defensive_manager.monitor_portfolio_defensive_needs(portfolio, market_data)
    
    print(f"\nPortfolio Summary:")
    print(f"Total positions: {portfolio_analysis['portfolio_summary']['total_positions']}")
    print(f"Positions needing action: {portfolio_analysis['portfolio_summary']['positions_needing_action']}")
    print(f"Emergency positions: {portfolio_analysis['portfolio_summary']['emergency_positions']}")
    
    if portfolio_analysis['alerts']:
        print("Portfolio Alerts:")
        for alert in portfolio_analysis['alerts']:
            print(f"- {alert['type']}: {alert['message']}")
    
    print("\n" + "="*50 + "\n")

def example_risk_parameters():
    """Example: Using centralized risk parameters"""
    print("=== RISK PARAMETERS EXAMPLE ===")
    
    # Get VIX regime information
    vix_level = 28.5
    vix_info = get_vix_regime_info(vix_level)
    
    print(f"VIX Level: {vix_level}")
    print(f"Regime: {vix_info['regime']}")
    print(f"BP Limit: {vix_info['bp_limit']:.1%}")
    print(f"Expected Duration: {vix_info['expected_duration']['description']}")
    
    # Check emergency status
    portfolio_loss = -0.08  # 8% portfolio loss
    correlation = 0.75      # 75% correlation
    
    emergency_status = check_emergency_status(portfolio_loss, vix_level, correlation)
    print(f"\nEmergency Status: {emergency_status['level_name']}")
    print(f"Response: {emergency_status['recommended_response']}")
    
    # Get all risk parameters
    risk_params = get_risk_parameters()
    
    # Example: Get strategy-specific parameters
    strategy_info = risk_params.get_strategy_parameters('LT112')
    print(f"\nLT112 Strategy Parameters:")
    print(f"Profit Target: {strategy_info['profit_target']:.1%}")
    print(f"Stop Loss: {strategy_info['stop_loss']:.1%}")
    print(f"Risk Rating: {strategy_info['risk_rating']}")
    
    # Validate all parameters
    validation = risk_params.validate_parameters()
    print(f"\nParameter Validation: {'PASSED' if validation['valid'] else 'FAILED'}")
    if validation['errors']:
        print("Errors:", validation['errors'])
    if validation['warnings']:
        print("Warnings:", validation['warnings'])
    
    print("\n" + "="*50 + "\n")

def example_august_2024_protection():
    """Example: August 2024 disaster protection"""
    print("=== AUGUST 2024 PROTECTION EXAMPLE ===")
    
    risk_params = get_risk_parameters()
    
    # Simulate Tom King's disaster scenario
    tom_king_portfolio = {
        'equity_concentration': 1.0,    # 100% equity index positions
        'average_correlation': 0.95,    # 95% correlation during crash
        'total_positions': 6            # 6 LT112 positions
    }
    
    # Our protected portfolio
    our_portfolio = {
        'equity_concentration': 0.45,   # 45% equity index positions
        'average_correlation': 0.65,    # 65% correlation
        'total_positions': 3            # 3 diverse positions
    }
    
    print("Tom King's August 2024 Disaster:")
    tom_protection = risk_params.check_august_2024_protection(tom_king_portfolio)
    print(f"Protection Level: {tom_protection['protection_status']['status']}")
    print(f"Overall Protection: {tom_protection['protection_analysis']['overall_protection']:.1%}")
    print(f"Estimated Loss: £308,000 (actual)")
    
    print("\nOur Protected Portfolio:")
    our_protection = risk_params.check_august_2024_protection(our_portfolio)
    print(f"Protection Level: {our_protection['protection_status']['status']}")
    print(f"Overall Protection: {our_protection['protection_analysis']['overall_protection']:.1%}")
    print(f"Estimated Loss Reduction: {our_protection['tom_king_comparison']['estimated_loss_reduction']:.1%}")
    
    if our_protection['protection_status']['warnings']:
        print("Warnings:")
        for warning in our_protection['protection_status']['warnings']:
            print(f"- {warning}")
    
    if our_protection['protection_status']['recommendations']:
        print("Recommendations:")
        for rec in our_protection['protection_status']['recommendations']:
            print(f"- {rec}")
    
    print("\n" + "="*50 + "\n")

def main():
    """Run all examples"""
    print("QuantConnect LEAN Risk Management Examples")
    print("Based on Tom King Complete Trading System Documentation 2025")
    print("=" * 80)
    print()
    
    try:
        example_position_sizing()
        example_correlation_management()
        example_defensive_management()
        example_risk_parameters()
        example_august_2024_protection()
        
        print("✅ All examples completed successfully!")
        print("\nThe risk management system is ready for QuantConnect LEAN integration.")
        
    except Exception as e:
        print(f"❌ Error running examples: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()