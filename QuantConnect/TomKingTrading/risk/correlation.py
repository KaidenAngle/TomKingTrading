# region imports
from AlgorithmImports import *
# endregion
# Tom King Trading Framework v17 - Correlation Analysis System
# Based on Tom King Complete Trading System Documentation (PDF Pages 12, 33, 34-35)

class CorrelationManager:
    """
    Tom King Correlation Group Management System
    Prevents overconcentration based on historical disaster analysis (August 5, 2024)
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        
        # Correlation Groups - CORRECTED to match Tom King documentation
        self.correlation_groups = {
            # Group A1: Equity Indices (Limit: 2)
            'A1': ['ES', 'MES', 'NQ', 'MNQ', 'RTY', 'M2K', 'YM', 'MYM'],
            
            # Group A2: Equity ETFs + IPMCC positions (Limit: 3)
            'A2': ['SPY', 'QQQ', 'IWM', 'DIA'],  # IPMCC positions counted here too
            
            # Group B1: Safe Haven (Limit: 2)
            'B1': ['GC', 'MGC', 'GLD', 'TLT', 'ZB', 'ZN'],
            
            # Group B2: Industrial Metals (Limit: 2)
            'B2': ['SI', 'SIL', 'SLV', 'HG', 'PL', 'PA'],
            
            # Group C1: Crude Complex (Limit: 2)
            'C1': ['CL', 'MCL', 'QM', 'RB', 'HO', 'XLE', 'XOP'],
            
            # Group C2: Natural Gas (Limit: 1)
            'C2': ['NG'],
            
            # Group D1: Grains (Limit: 2)
            'D1': ['ZC', 'ZS', 'ZW'],
            
            # Group D2: Proteins (Limit: 1)
            'D2': ['LE', 'HE', 'GF'],
            
            # Group E: Currencies (Limit: 2)
            'E': ['6E', '6B', '6A', '6C', 'M6E', 'M6A', 'DXY']
        }
        
        # Position limits per group - CORRECTED to match documentation
        self.group_limits = {
            'A1': 2,  # Equity Indices (Limit: 2)
            'A2': 3,  # Equity ETFs + IPMCC positions (Limit: 3)  
            'B1': 2,  # Safe Haven (Limit: 2)
            'B2': 2,  # Industrial Metals (Limit: 2)
            'C1': 2,  # Crude Complex (Limit: 2)
            'C2': 1,  # Natural Gas (Limit: 1)
            'D1': 2,  # Grains (Limit: 2)
            'D2': 1,  # Proteins (Limit: 1)
            'E': 2    # Currencies (Limit: 2)
        }
        
        # August 5, 2024 crisis correlation analysis
        self.crisis_correlation_weights = {
            'A1': 0.95,  # Equity Indices - Nearly perfect correlation during crashes
            'A2': 0.90,  # Equity ETFs - Very high correlation with indices
            'B1': -0.20, # Safe Haven - Inverse correlation (but can fail like TLT)
            'B2': 0.70,  # Industrial Metals - High correlation with risk-on/off
            'C1': 0.75,  # Crude Complex - High correlation with economic cycles
            'C2': 0.60,  # Natural Gas - Moderate correlation with broader markets
            'D1': 0.50,  # Grains - Moderate correlation with risk sentiment
            'D2': 0.45,  # Proteins - Lower correlation, more supply/demand driven
            'E': 0.80    # Currencies - High correlation with USD strength/weakness
        }
    
    def get_symbol_correlation_group(self, symbol):
        """Determine which correlation group a symbol belongs to"""
        symbol_str = str(symbol).upper()
        
        # Handle different symbol formats
        if hasattr(symbol, 'Value'):
            symbol_str = symbol.Value.upper()
        elif hasattr(symbol, 'ID'):
            if hasattr(symbol.ID, 'Symbol'):
                symbol_str = symbol.ID.Symbol.upper()
        
        for group_name, symbols in self.correlation_groups.items():
            if symbol_str in symbols:
                return group_name
        
        # Default to A1 for equity-like products
        if any(equity in symbol_str for equity in ['SPY', 'QQQ', 'IWM', 'ES', 'NQ']):
            return 'A1'
            
        return None
    
    def get_current_group_positions(self, group_name, current_positions=None):
        """Get current positions in a specific correlation group"""
        if current_positions is None:
            current_positions = [holding for holding in self.algorithm.Portfolio 
                               if holding.Value.Invested]
        
        group_positions = []
        group_symbols = self.correlation_groups.get(group_name, [])
        
        for position in current_positions:
            symbol_str = str(position.Key).upper()
            if hasattr(position.Key, 'Value'):
                symbol_str = position.Key.Value.upper()
                
            if symbol_str in group_symbols:
                group_positions.append({
                    'symbol': symbol_str,
                    'quantity': position.Value.Quantity,
                    'market_value': position.Value.HoldingsValue,
                    'unrealized_pnl': position.Value.UnrealizedProfit
                })
        
        return group_positions
    
    def can_add_to_group(self, symbol, account_phase):
        """
        Check if we can add another position to this symbol's correlation group
        Returns: (can_add: bool, reason: str, current_count: int, max_allowed: int)
        """
        group_name = self.get_symbol_correlation_group(symbol)
        
        if not group_name:
            return True, "Symbol not in tracked correlation groups", 0, 999
        
        # Get phase limits
        phase_key = f'phase{account_phase}'
        limits = self.group_limits.get(phase_key, self.group_limits['phase1'])
        
        # Special handling for volatility group
        if group_name == 'G':
            max_allowed = limits['volatility_group_max']
        else:
            max_allowed = limits['max_per_group']
        
        # Count current positions in this group
        current_positions = self.get_current_group_positions(group_name)
        current_count = len(current_positions)
        
        can_add = current_count < max_allowed
        
        if not can_add:
            reason = f"Correlation group {group_name} at maximum ({current_count}/{max_allowed})"
            return False, reason, current_count, max_allowed
        
        return True, f"Can add to group {group_name} ({current_count}/{max_allowed})", current_count, max_allowed
    
    def calculate_portfolio_correlation_risk(self, account_phase):
        """
        Calculate overall portfolio correlation risk score (0-100)
        Higher score = higher correlation risk
        """
        risk_score = 0
        group_concentrations = {}
        
        # Get current positions by group
        for group_name in self.correlation_groups.keys():
            positions = self.get_current_group_positions(group_name)
            if positions:
                group_value = sum(pos['market_value'] for pos in positions)
                group_concentrations[group_name] = {
                    'count': len(positions),
                    'value': group_value,
                    'positions': positions
                }
        
        total_portfolio_value = float(self.algorithm.Portfolio.TotalPortfolioValue)
        if total_portfolio_value <= 0:
            return 0
        
        # Calculate risk components
        for group_name, data in group_concentrations.items():
            count = data['count']
            value_pct = abs(data['value']) / total_portfolio_value
            crisis_weight = self.crisis_correlation_weights.get(group_name, 0.5)
            
            # Phase limits
            phase_key = f'phase{account_phase}'
            limits = self.group_limits.get(phase_key, self.group_limits['phase1'])
            max_allowed = limits['volatility_group_max'] if group_name == 'G' else limits['max_per_group']
            
            # Position count risk
            count_risk = min(100, (count / max_allowed) * 100)
            
            # Concentration risk  
            concentration_risk = min(100, value_pct * 200)  # 50% = 100 risk points
            
            # Crisis correlation risk
            crisis_risk = crisis_weight * 100
            
            # Combined group risk
            group_risk = (count_risk * 0.4 + concentration_risk * 0.4 + crisis_risk * 0.2)
            risk_score += group_risk * value_pct  # Weight by portfolio percentage
        
        return min(100, risk_score)
    
    def get_correlation_summary(self, account_phase):
        """Generate complete correlation analysis summary"""
        summary = {
            'account_phase': account_phase,
            'risk_score': self.calculate_portfolio_correlation_risk(account_phase),
            'groups': {},
            'recommendations': [],
            'warnings': []
        }
        
        # Analyze each group
        for group_name, symbols in self.correlation_groups.items():
            positions = self.get_current_group_positions(group_name)
            
            if positions:
                phase_key = f'phase{account_phase}'
                limits = self.group_limits.get(phase_key, self.group_limits['phase1'])
                max_allowed = limits['volatility_group_max'] if group_name == 'G' else limits['max_per_group']
                
                group_value = sum(pos['market_value'] for pos in positions)
                portfolio_pct = (abs(group_value) / float(self.algorithm.Portfolio.TotalPortfolioValue)) * 100
                
                summary['groups'][group_name] = {
                    'name': group_name,
                    'description': self._get_group_description(group_name),
                    'position_count': len(positions),
                    'max_allowed': max_allowed,
                    'total_value': group_value,
                    'portfolio_percentage': portfolio_pct,
                    'positions': positions,
                    'crisis_correlation': self.crisis_correlation_weights.get(group_name, 0.5),
                    'at_limit': len(positions) >= max_allowed
                }
                
                # Generate warnings
                if len(positions) >= max_allowed:
                    summary['warnings'].append(f"Group {group_name} at maximum positions ({len(positions)}/{max_allowed})")
                
                if portfolio_pct > 40:
                    summary['warnings'].append(f"Group {group_name} over 40% of portfolio ({portfolio_pct:.1f}%)")
        
        # Risk-based recommendations
        if summary['risk_score'] > 75:
            summary['recommendations'].append("HIGH CORRELATION RISK - Reduce concentrated positions")
        elif summary['risk_score'] > 50:
            summary['recommendations'].append("MEDIUM CORRELATION RISK - Monitor group limits")
        elif summary['risk_score'] > 25:
            summary['recommendations'].append("LOW CORRELATION RISK - Within acceptable limits")
        else:
            summary['recommendations'].append("MINIMAL CORRELATION RISK - Good diversification")
        
        # August 5, 2024 specific check
        a1_positions = summary['groups'].get('A1', {}).get('position_count', 0)
        if a1_positions >= 3:
            summary['warnings'].append("⚠️ AUGUST 5TH PROTECTION: Group A1 heavily weighted - reduce equity index exposure")
        
        return summary
    
    def _get_group_description(self, group_name):
        """Get human-readable description of correlation group"""
        descriptions = {
            'A1': 'Major US Equity Indices (ES, SPY, QQQ, IWM)',
            'A2': 'International & Secondary Equity',
            'B1': 'Energy Complex (Oil, Gas, Energy ETFs)', 
            'C1': 'Precious Metals (Gold, Silver)',
            'D1': 'Agriculture & Soft Commodities',
            'E': 'Fixed Income & Interest Rates',
            'F': 'Currencies & USD Strength',
            'G': 'Volatility Products (VIX, UVXY)'
        }
        return descriptions.get(group_name, f'Group {group_name}')
    
    def enforce_correlation_limits(self, symbol, account_phase):
        """
        Enforce correlation limits before position entry
        Returns: (allowed: bool, message: str)
        """
        can_add, reason, current, max_allowed = self.can_add_to_group(symbol, account_phase)
        
        if not can_add:
            self.algorithm.Log(f"CORRELATION LIMIT BLOCKED: {symbol} - {reason}")
            return False, f"Blocked: {reason}"
        
        # Log successful check
        group_name = self.get_symbol_correlation_group(symbol)
        if group_name:
            self.algorithm.Log(f"CORRELATION CHECK PASSED: {symbol} can be added to group {group_name} ({current + 1}/{max_allowed})")
        
        return True, f"Approved for group {group_name} ({current + 1}/{max_allowed})"
    
    def get_diversification_opportunities(self, account_phase):
        """
        Suggest symbols that would improve diversification
        Returns list of recommended symbols by group
        """
        opportunities = {}
        
        for group_name, symbols in self.correlation_groups.items():
            positions = self.get_current_group_positions(group_name)
            
            # Skip if group is at limit
            can_add, _, current, max_allowed = self.can_add_to_group(symbols[0] if symbols else 'SPY', account_phase)
            
            if can_add and len(positions) == 0:
                # Empty groups are opportunities
                opportunities[group_name] = {
                    'description': self._get_group_description(group_name),
                    'suggested_symbols': symbols[:3],  # Top 3 symbols
                    'rationale': 'Improve diversification by adding uncorrelated exposure'
                }
        
        return opportunities
    
    def validate_correlation_system(self):
        """Validate correlation system functionality"""
        tests = [
            ('SPY in A1 group', 'SPY' in self.correlation_groups['A1']),
            ('GLD in C1 group', 'GLD' in self.correlation_groups['C1']),
            ('VIX in G group', 'VIX' in self.correlation_groups['G']),
            ('7 groups defined', len(self.correlation_groups) == 7),
            ('Phase limits defined', len(self.group_limits) == 4)
        ]
        
        results = []
        for test_name, condition in tests:
            results.append(f"{'✅' if condition else '❌'} {test_name}")
        
        return results

# Usage Example for QuantConnect Algorithm:
# 
# def Initialize(self):
#     self.correlation_manager = CorrelationManager(self)
# 
# def OnData(self, data):
#     # Before placing any trade
#     symbol = "SPY"
#     account_phase = 2
#     
#     allowed, message = self.correlation_manager.enforce_correlation_limits(symbol, account_phase)
#     if allowed:
#         # Place trade
#         self.SetHoldings(symbol, 0.1)
#         
#     # Get correlation summary
#     summary = self.correlation_manager.get_correlation_summary(account_phase)
#     if summary['risk_score'] > 75:
#         self.Log("HIGH CORRELATION RISK DETECTED")

class CorrelationGroup:
    """
    Represents a correlation group for tracking related symbols
    """
    
    def __init__(self, group_id, symbols, crisis_weight=0.0):
        self.group_id = group_id
        self.symbols = symbols
        self.crisis_weight = crisis_weight
        self.current_positions = []
        self.exposure = 0.0
    
    def add_position(self, symbol, size):
        """Add a position to this group"""
        self.current_positions.append({
            'symbol': symbol,
            'size': size
        })
        self.exposure += abs(size)
    
    def remove_position(self, symbol):
        """Remove a position from this group"""
        self.current_positions = [p for p in self.current_positions if p['symbol'] != symbol]
        self.exposure = sum(abs(p['size']) for p in self.current_positions)
    
    def get_exposure(self):
        """Get total exposure for this group"""
        return self.exposure
    
    def has_symbol(self, symbol):
        """Check if symbol belongs to this group"""
        return symbol in self.symbols