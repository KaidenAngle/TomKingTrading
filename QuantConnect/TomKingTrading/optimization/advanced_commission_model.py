#!/usr/bin/env python3
"""
Advanced Commission Model - Phase 4 Optimization
Accurate per-strategy commission calculation with broker-specific rates
"""

from typing import Dict, Optional
from datetime import datetime

# Import SecurityType enum
try:
    from QuantConnect import SecurityType
except ImportError:
    # Fallback for local testing
    class SecurityType:
        Equity = 1
        Option = 2
        Future = 3
        FutureOption = 4

class AdvancedCommissionModel:
    """
    Sophisticated commission model supporting multiple brokers and strategies
    Includes tiered pricing, regulatory fees, and strategy-specific optimizations
    """
    
    def __init__(self, algorithm, broker: str = "tastytrade"):
        self.algo = algorithm
        self.broker = broker.lower()
        
        # Commission tracking
        self.total_commissions = 0.0
        self.commissions_by_strategy: Dict[str, float] = {}
        self.commissions_by_symbol: Dict[str, float] = {}
        self.daily_commissions: Dict[datetime, float] = {}
        
        # Define broker-specific rates
        self.commission_rates = self._get_broker_rates()
        
    def _get_broker_rates(self) -> Dict:
        """Get commission rates for specific broker"""
        rates = {
            'tastytrade': {
                'stock': 0.0,  # Zero commission on stocks
                'stock_minimum': 0.0,
                'option': 1.00,  # Per contract
                'option_minimum': 0.0,
                'option_maximum': 10.00,  # Per leg
                'futures': 1.25,  # Per contract
                'futures_options': 2.50,  # Per contract
                'assignment_exercise': 5.00,  # Per event
                'regulatory_fees': {
                    'sec_fee': 0.0000278,  # Per dollar of sales proceeds
                    'taf_fee': 0.000145,  # Per share sold (max $7.27 per trade)
                    'orf_fee': 0.00279,  # Per contract
                    'finra_fee': 0.00279  # Options regulatory fee
                }
            },
            'ibkr': {
                'stock': 0.005,  # Per share
                'stock_minimum': 1.00,
                'stock_maximum': 0.005,  # 0.5% of trade value max
                'option': 0.65,  # Per contract
                'option_minimum': 1.00,
                'futures': 0.85,  # Per contract
                'futures_options': 1.42,
                'assignment_exercise': 0.00,
                'regulatory_fees': {
                    'sec_fee': 0.0000278,
                    'taf_fee': 0.000145,
                    'orf_fee': 0.00279,
                    'finra_fee': 0.00279
                }
            },
            'td_ameritrade': {
                'stock': 0.0,  # Zero commission
                'stock_minimum': 0.0,
                'option': 0.65,  # Per contract
                'option_minimum': 0.0,
                'futures': 2.25,
                'futures_options': 2.25,
                'assignment_exercise': 0.00,
                'regulatory_fees': {
                    'sec_fee': 0.0000278,
                    'taf_fee': 0.000145,
                    'orf_fee': 0.00456,
                    'finra_fee': 0.00456
                }
            }
        }
        
        return rates.get(self.broker, rates['tastytrade'])
    
    def calculate_order_commission(self, order_event) -> float:
        """Calculate commission for a specific order"""
        if order_event.Status != 2:  # Not filled
            return 0.0
        
        symbol = order_event.Symbol
        quantity = abs(order_event.FillQuantity)
        fill_price = order_event.FillPrice
        
        commission = 0.0
        
        # Determine security type
        security_type = self.algo.Securities[symbol].Type if symbol in self.algo.Securities else SecurityType.Equity
        
        if security_type == SecurityType.Equity:
            commission = self._calculate_stock_commission(quantity, fill_price)
        elif security_type == SecurityType.Option:
            commission = self._calculate_option_commission(quantity, fill_price, order_event)
        elif security_type == SecurityType.Future:
            commission = self._calculate_futures_commission(quantity)
        elif security_type == SecurityType.FutureOption:
            commission = self._calculate_futures_option_commission(quantity)
        
        # Add regulatory fees
        commission += self._calculate_regulatory_fees(security_type, quantity, fill_price)
        
        # Track commission
        self._track_commission(commission, order_event)
        
        return commission
    
    def _calculate_stock_commission(self, quantity: int, price: float) -> float:
        """Calculate stock commission"""
        rates = self.commission_rates
        
        if self.broker == "ibkr":
            commission = quantity * rates['stock']
            commission = max(commission, rates['stock_minimum'])
            commission = min(commission, price * quantity * rates['stock_maximum'])
        else:
            commission = rates['stock'] * quantity
        
        return commission
    
    def _calculate_option_commission(self, quantity: int, price: float, order_event) -> float:
        """Calculate option commission with strategy-specific optimizations"""
        rates = self.commission_rates
        contracts = quantity  # Options are in contracts
        
        # Base commission
        commission = contracts * rates['option']
        
        # Apply maximum per leg if applicable
        if 'option_maximum' in rates and rates['option_maximum'] > 0:
            commission = min(commission, rates['option_maximum'])
        
        # Apply minimum if applicable
        if 'option_minimum' in rates:
            commission = max(commission, rates['option_minimum'])
        
        # Strategy-specific adjustments for multi-leg orders
        if hasattr(order_event, 'Tag') and order_event.Tag:
            if 'SPREAD' in order_event.Tag.upper():
                # Reduced rate for spreads at some brokers
                if self.broker == "tastytrade":
                    commission = min(commission, 10.00)  # Cap at $10 per spread
            elif 'BUTTERFLY' in order_event.Tag.upper():
                # Special pricing for butterflies
                if self.broker == "tastytrade":
                    commission = min(commission, 12.50)  # Cap for butterfly
        
        return commission
    
    def _calculate_futures_commission(self, quantity: int) -> float:
        """Calculate futures commission"""
        rates = self.commission_rates
        return quantity * rates.get('futures', 2.25)
    
    def _calculate_futures_option_commission(self, quantity: int) -> float:
        """Calculate futures option commission"""
        rates = self.commission_rates
        return quantity * rates.get('futures_options', 2.50)
    
    def _calculate_regulatory_fees(self, security_type, quantity: int, price: float) -> float:
        """Calculate regulatory fees (SEC, TAF, ORF, etc.)"""
        fees = 0.0
        reg_fees = self.commission_rates.get('regulatory_fees', {})
        
        if security_type == SecurityType.Equity:
            # SEC fee on sales
            if price > 0:  # Selling
                fees += price * quantity * reg_fees.get('sec_fee', 0)
            
            # TAF fee
            taf = quantity * reg_fees.get('taf_fee', 0)
            fees += min(taf, 7.27)  # Cap at $7.27 per trade
            
        elif security_type == SecurityType.Option:
            # ORF fee per contract
            fees += quantity * reg_fees.get('orf_fee', 0)
            
            # FINRA fee
            fees += quantity * reg_fees.get('finra_fee', 0)
        
        return fees
    
    def _track_commission(self, commission: float, order_event):
        """Track commission for reporting"""
        self.total_commissions += commission
        
        # Track by date
        date = self.algo.Time.date()
        if date not in self.daily_commissions:
            self.daily_commissions[date] = 0
        self.daily_commissions[date] += commission
        
        # Track by symbol
        symbol = str(order_event.Symbol)
        if symbol not in self.commissions_by_symbol:
            self.commissions_by_symbol[symbol] = 0
        self.commissions_by_symbol[symbol] += commission
        
        # Track by strategy if tagged
        if hasattr(order_event, 'Tag') and order_event.Tag:
            strategy = order_event.Tag.split('_')[0] if '_' in order_event.Tag else order_event.Tag
            if strategy not in self.commissions_by_strategy:
                self.commissions_by_strategy[strategy] = 0
            self.commissions_by_strategy[strategy] += commission
    
    def calculate_assignment_fee(self) -> float:
        """Calculate assignment or exercise fee"""
        return self.commission_rates.get('assignment_exercise', 5.00)
    
    def get_commission_summary(self) -> Dict:
        """Get comprehensive commission summary"""
        avg_daily = (sum(self.daily_commissions.values()) / len(self.daily_commissions)) if self.daily_commissions else 0
        
        return {
            'total_commissions': self.total_commissions,
            'average_daily': avg_daily,
            'by_strategy': dict(self.commissions_by_strategy),
            'by_symbol': dict(sorted(self.commissions_by_symbol.items(), 
                                    key=lambda x: x[1], reverse=True)[:10]),  # Top 10
            'broker': self.broker,
            'commission_as_pct_of_capital': (self.total_commissions / 
                                            self.algo.Portfolio.TotalPortfolioValue * 100) 
                                            if self.algo.Portfolio.TotalPortfolioValue > 0 else 0
        }
    
    def optimize_order_routing(self, strategy: str, legs: int) -> Dict:
        """Suggest optimal order routing based on commission structure"""
        suggestions = {
            'route_as_spread': False,
            'use_smart_routing': False,
            'estimated_commission': 0.0
        }
        
        # Multi-leg optimization
        if legs > 1:
            # Calculate as individual legs
            individual_commission = legs * self.commission_rates['option']
            
            # Calculate as spread (if broker supports)
            spread_commission = min(individual_commission, 
                                   self.commission_rates.get('option_maximum', individual_commission))
            
            if spread_commission < individual_commission:
                suggestions['route_as_spread'] = True
                suggestions['estimated_commission'] = spread_commission
            else:
                suggestions['estimated_commission'] = individual_commission
        else:
            suggestions['estimated_commission'] = self.commission_rates['option']
        
        # Smart routing for best execution
        if self.broker == "ibkr":
            suggestions['use_smart_routing'] = True
        
        return suggestions