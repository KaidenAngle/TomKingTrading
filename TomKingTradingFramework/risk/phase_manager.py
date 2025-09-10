# Phase-Based Position Management for LEAN
# Implements Tom King's account phase progression system
from AlgorithmImports import *

class PhaseManager:
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Define account phases per Tom King methodology
        self.phases = {
            1: {
                'min_balance': 30000,
                'max_balance': 40000,
                'strategies': ['FRIDAY_0DTE', 'LONG_TERM_112', 'FUTURES_STRANGLES'],
                'max_positions': 6,
                'max_risk_per_trade': 0.03,  # 3% max risk
                'description': 'Foundation Phase'
            },
            2: {
                'min_balance': 40000,
                'max_balance': 60000,
                'strategies': ['FRIDAY_0DTE', 'LONG_TERM_112', 'FUTURES_STRANGLES', 
                             'IPMCC', 'POOR_MANS_COVERED_CALL'],
                'max_positions': 10,
                'max_risk_per_trade': 0.04,  # 4% max risk
                'description': 'Growth Phase'
            },
            3: {
                'min_balance': 60000,
                'max_balance': 75000,
                'strategies': ['FRIDAY_0DTE', 'LONG_TERM_112', 'FUTURES_STRANGLES',
                             'IPMCC', 'POOR_MANS_COVERED_CALL', 'LEAP_PUT_LADDERS',
                             'ENHANCED_BUTTERFLY', 'RATIO_SPREADS'],
                'max_positions': 12,
                'max_risk_per_trade': 0.05,  # 5% max risk
                'description': 'Advanced Phase'
            },
            4: {
                'min_balance': 75000,
                'max_balance': float('inf'),
                'strategies': 'ALL',  # All strategies available
                'max_positions': 15,
                'max_risk_per_trade': 0.05,  # 5% max risk
                'description': 'Professional Phase'
            }
        }
        
        self.current_phase = 1
        self.UpdatePhase()
    
    def UpdatePhase(self):
        """Update account phase based on portfolio value"""
        portfolio_value = self.algo.Portfolio.TotalPortfolioValue
        
        for phase_num, phase_data in self.phases.items():
            if phase_data['min_balance'] <= portfolio_value < phase_data['max_balance']:
                if phase_num != self.current_phase:
                    self.current_phase = phase_num
                    self.algo.Log(f"PHASE TRANSITION: Moving to Phase {phase_num} - {phase_data['description']}")
                    self.algo.Log(f"Portfolio Value: ${portfolio_value:,.2f}")
                break
        
        return self.current_phase
    
    def IsStrategyAllowed(self, strategy_name: str) -> bool:
        """Check if strategy is allowed in current phase"""
        phase_data = self.phases[self.current_phase]
        
        if phase_data['strategies'] == 'ALL':
            return True
        
        return strategy_name in phase_data['strategies']
    
    def GetMaxPositions(self) -> int:
        """Get maximum positions allowed for current phase"""
        return self.phases[self.current_phase]['max_positions']
    
    def GetMaxRiskPerTrade(self) -> float:
        """Get maximum risk per trade for current phase"""
        return self.phases[self.current_phase]['max_risk_per_trade']
    
    def CalculatePositionSize(self, strategy_name: str, risk_amount: float = None) -> int:
        """Calculate position size based on phase limits"""
        if not self.IsStrategyAllowed(strategy_name):
            self.algo.Log(f"Strategy {strategy_name} not allowed in Phase {self.current_phase}")
            return 0
        
        portfolio_value = self.algo.Portfolio.TotalPortfolioValue
        max_risk = portfolio_value * self.GetMaxRiskPerTrade()
        
        if risk_amount and risk_amount > max_risk:
            # Scale down to max risk
            return int(max_risk / risk_amount)
        
        # Default to 1 contract if risk not specified
        return 1
    
    def GetPhaseMetrics(self) -> dict:
        """Get current phase metrics and progression"""
        portfolio_value = self.algo.Portfolio.TotalPortfolioValue
        phase_data = self.phases[self.current_phase]
        
        # Calculate progress to next phase
        progress_pct = 0
        if self.current_phase < 4:
            next_phase_min = self.phases[self.current_phase + 1]['min_balance']
            phase_range = next_phase_min - phase_data['min_balance']
            progress = portfolio_value - phase_data['min_balance']
            progress_pct = (progress / phase_range) * 100 if phase_range > 0 else 0
        
        return {
            'current_phase': self.current_phase,
            'phase_name': phase_data['description'],
            'portfolio_value': portfolio_value,
            'min_balance': phase_data['min_balance'],
            'max_balance': phase_data['max_balance'],
            'max_positions': phase_data['max_positions'],
            'max_risk_per_trade': phase_data['max_risk_per_trade'],
            'progress_to_next': progress_pct,
            'strategies_available': len(phase_data['strategies']) if phase_data['strategies'] != 'ALL' else 17
        }
    
    def GetTomKingWisdom(self) -> list:
        """Tom King's 15 Trading Wisdom Rules"""
        return [
            "1. Never risk more than 5% on a single trade",
            "2. Always manage positions at 21 DTE if challenged",
            "3. Take profits at 50% for most strategies",
            "4. Avoid earnings plays - too much gamma risk",
            "5. VIX determines position sizing - higher VIX = more BP",
            "6. Friday 0DTE only after 10:30 AM",
            "7. Correlation limits: Max 3 equity index positions",
            "8. Emergency protocol: Close all 0DTE if VIX > 40",
            "9. Long Term 1-1-2 is the bread and butter strategy",
            "10. Futures strangles provide diversification",
            "11. Always have a defensive plan before entering",
            "12. Win rate matters more than win size",
            "13. Consistency beats home runs",
            "14. Phase progression is earned, not rushed",
            "15. Professional trading is about risk management"
        ]
    
    def ApplyWisdomRules(self, trade_params: dict) -> dict:
        """Apply Tom King's wisdom rules to trade parameters"""
        # Rule 1: Never risk more than 5%
        if trade_params.get('risk_pct', 0) > 0.05:
            trade_params['risk_pct'] = 0.05
            self.algo.Log("Wisdom Rule 1: Capped risk at 5%")
        
        # Rule 4: Avoid earnings
        if trade_params.get('near_earnings', False):
            trade_params['allowed'] = False
            self.algo.Log("Wisdom Rule 4: Trade blocked due to earnings")
        
        # Rule 6: Friday 0DTE timing
        if trade_params.get('strategy') == 'FRIDAY_0DTE':
            if self.algo.Time.hour < 10 or (self.algo.Time.hour == 10 and self.algo.Time.minute < 30):
                trade_params['allowed'] = False
                self.algo.Log("Wisdom Rule 6: Friday 0DTE only after 10:30 AM")
        
        return trade_params
    
    def GetMonthlyTarget(self) -> float:
        """Get monthly return target based on phase"""
        targets = {
            1: 0.05,  # 5% monthly in Phase 1
            2: 0.08,  # 8% monthly in Phase 2
            3: 0.10,  # 10% monthly in Phase 3
            4: 0.12   # 12% monthly in Phase 4 (Professional)
        }
        return targets.get(self.current_phase, 0.05)
    
    def ShouldReinvest(self) -> bool:
        """Determine if profits should be reinvested or withdrawn"""
        portfolio_value = self.algo.Portfolio.TotalPortfolioValue
        
        # Phase 1-3: Reinvest to reach next phase
        if self.current_phase < 4:
            return True
        
        # Phase 4: 50% reinvestment, 50% income
        # This is simplified - in production would track actual profits
        return portfolio_value < 100000  # Reinvest until 100k, then focus on income
