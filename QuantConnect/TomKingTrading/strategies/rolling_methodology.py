# Tom King Trading Framework - Rolling Methodology & DTE Management
# Implements Tom King's proven rolling techniques for optimal position management

from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from enum import Enum
from dataclasses import dataclass

class RollTrigger(Enum):
    """Triggers for rolling positions"""
    DTE_21 = "dte_21"           # 21 DTE rule
    PROFIT_TARGET = "profit_50"  # 50% profit target
    LOSS_LIMIT = "loss_200"      # 200% loss limit
    VOLATILITY_SPIKE = "vol_spike" # VIX spike >25
    EARLY_ASSIGNMENT = "early_assign" # Risk of early assignment

class RollDirection(Enum):
    """Direction of roll"""
    FORWARD = "forward"        # Roll to next expiration
    BACKWARD = "backward"      # Roll to earlier expiration
    SIDEWAYS = "sideways"      # Same expiration, different strikes

class PositionType(Enum):
    """Position types for rolling"""
    STRANGLE = "strangle"
    IRON_CONDOR = "iron_condor"
    PUT_SPREAD = "put_spread"
    CALL_SPREAD = "call_spread"
    STRADDLE = "straddle"
    BUTTERFLY = "butterfly"
    CALENDAR = "calendar"

@dataclass
class RollingPosition:
    """Tracks position for rolling management"""
    symbol: str
    position_type: PositionType
    entry_date: datetime
    expiration_date: datetime
    strikes: List[float]
    contracts: List[int]  # +1 for long, -1 for short
    entry_price: float
    current_price: float
    days_to_expiration: int
    profit_loss_percent: float
    theta_decay: float
    delta_exposure: float
    gamma_risk: float
    vega_exposure: float
    max_loss: float
    roll_priority: int  # 1=immediate, 5=monitor

class TomKingRollingSystem:
    """
    Tom King's Rolling Methodology Implementation
    
    Key Rules:
    1. 21 DTE Rule: All positions managed at 21 days to expiration
    2. 50% Profit Target: Roll winners at 50% of max profit
    3. Volatility Management: Roll during VIX spikes >25
    4. Strike Selection: Maintain similar risk/reward profile
    5. Expiration Cycles: Target 30-45 DTE on rolls
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.active_positions: Dict[str, RollingPosition] = {}
        self.roll_history: List[Dict] = []
        self.next_expiration_cycles = []
        
        # Tom King Rolling Parameters
        self.DTE_MANAGEMENT_THRESHOLD = 21
        self.PROFIT_TARGET_PERCENT = 50.0
        self.LOSS_LIMIT_PERCENT = 200.0
        self.VIX_SPIKE_THRESHOLD = 25.0
        self.MIN_ROLL_DTE = 30
        self.MAX_ROLL_DTE = 45
        
        # Rolling preferences by position type
        self.roll_preferences = {
            PositionType.STRANGLE: {
                "preferred_dte": 35,
                "delta_target": 0.15,
                "profit_target": 50.0,
                "max_loss_multiplier": 2.0
            },
            PositionType.IRON_CONDOR: {
                "preferred_dte": 30,
                "delta_target": 0.10,
                "profit_target": 50.0,
                "max_loss_multiplier": 3.0
            },
            PositionType.PUT_SPREAD: {
                "preferred_dte": 40,
                "delta_target": 0.20,
                "profit_target": 50.0,
                "max_loss_multiplier": 2.5
            }
        }

    def UpdatePositions(self) -> Dict[str, Any]:
        """Update all positions with current market data"""
        results = {
            "positions_updated": 0,
            "rolls_triggered": 0,
            "positions_requiring_action": []
        }
        
        for position_id, position in self.active_positions.items():
            # Update position metrics
            self._UpdatePositionMetrics(position)
            
            # Check roll triggers
            roll_trigger = self._CheckRollTriggers(position)
            
            if roll_trigger:
                results["rolls_triggered"] += 1
                results["positions_requiring_action"].append({
                    "position_id": position_id,
                    "trigger": roll_trigger,
                    "position": position
                })
            
            results["positions_updated"] += 1
        
        return results

    def ExecuteRollingDecisions(self) -> Dict[str, Any]:
        """Execute rolling decisions for all positions"""
        results = {
            "positions_rolled": 0,
            "positions_closed": 0,
            "roll_failures": 0,
            "total_pnl_impact": 0.0
        }
        
        positions_to_process = []
        
        # Identify positions needing rolls
        for position_id, position in self.active_positions.items():
            roll_trigger = self._CheckRollTriggers(position)
            if roll_trigger:
                positions_to_process.append((position_id, position, roll_trigger))
        
        # Sort by priority (most urgent first)
        positions_to_process.sort(key=lambda x: x[1].roll_priority)
        
        # Execute rolls
        for position_id, position, trigger in positions_to_process:
            roll_result = self._ExecutePositionRoll(position_id, position, trigger)
            
            if roll_result["success"]:
                results["positions_rolled"] += 1
                results["total_pnl_impact"] += roll_result["pnl_impact"]
            else:
                # If roll failed, consider closing
                if self._ShouldCloseInsteadOfRoll(position, trigger):
                    close_result = self._ClosePosition(position_id, position)
                    if close_result["success"]:
                        results["positions_closed"] += 1
                        results["total_pnl_impact"] += close_result["pnl_impact"]
                else:
                    results["roll_failures"] += 1
        
        return results

    def _UpdatePositionMetrics(self, position: RollingPosition) -> None:
        """Update position metrics with current market data"""
        try:
            # Calculate DTE
            position.days_to_expiration = (position.expiration_date - self.algorithm.Time).days
            
            # Get current option prices and Greeks
            position_value = self._CalculatePositionValue(position)
            position.current_price = position_value
            
            # Calculate P&L percentage with safe division
            if position.entry_price != 0:
                position.profit_loss_percent = ((position.current_price - position.entry_price) / 
                                               abs(position.entry_price)) * 100
            else:
                position.profit_loss_percent = 0
                self.algorithm.Error(f"Invalid entry price for position {position.id}")
            
            # Update Greeks
            greeks = self._CalculatePositionGreeks(position)
            position.theta_decay = greeks.get("theta", 0)
            position.delta_exposure = greeks.get("delta", 0)
            position.gamma_risk = greeks.get("gamma", 0)
            position.vega_exposure = greeks.get("vega", 0)
            
            # Set roll priority
            position.roll_priority = self._CalculateRollPriority(position)
            
        except Exception as e:
            self.algorithm.Debug(f"Error updating position metrics: {e}")

    def _CheckRollTriggers(self, position: RollingPosition) -> Optional[RollTrigger]:
        """Check if position should be rolled"""
        
        # Priority 1: 21 DTE Rule
        if position.days_to_expiration <= self.DTE_MANAGEMENT_THRESHOLD:
            return RollTrigger.DTE_21
        
        # Priority 2: Profit Target Hit
        if position.profit_loss_percent >= self.PROFIT_TARGET_PERCENT:
            return RollTrigger.PROFIT_TARGET
        
        # Priority 3: Loss Limit Approached
        if position.profit_loss_percent <= -self.LOSS_LIMIT_PERCENT:
            return RollTrigger.LOSS_LIMIT
        
        # Priority 4: VIX Spike (opportunity to roll for credit)
        try:
            vix_value = self.algorithm.Securities["VIX"].Price
            if vix_value > self.VIX_SPIKE_THRESHOLD:
                return RollTrigger.VOLATILITY_SPIKE
        except Exception as e:
            if hasattr(self, 'algorithm') and hasattr(self.algorithm, 'Error'):
                self.algorithm.Error(f"Error checking early assignment risk: {str(e)}")
        
        # Priority 5: Early Assignment Risk
        if self._HasEarlyAssignmentRisk(position):
            return RollTrigger.EARLY_ASSIGNMENT
        
        return None

    def _ExecutePositionRoll(self, position_id: str, position: RollingPosition, 
                            trigger: RollTrigger) -> Dict[str, Any]:
        """Execute the rolling of a position"""
        result = {
            "success": False,
            "pnl_impact": 0.0,
            "new_position_id": None,
            "roll_details": {}
        }
        
        try:
            # Determine roll strategy based on trigger
            roll_strategy = self._DetermineRollStrategy(position, trigger)
            
            # Find suitable expiration and strikes
            roll_parameters = self._FindOptimalRollParameters(position, roll_strategy)
            
            if not roll_parameters:
                result["error"] = "No suitable roll parameters found"
                return result
            
            # Execute the roll trade
            roll_execution = self._ExecuteRollTrade(position, roll_parameters)
            
            if roll_execution["success"]:
                # Update position tracking
                new_position = self._CreateRolledPosition(position, roll_parameters, 
                                                         roll_execution)
                new_position_id = f"{position.symbol}_{new_position.expiration_date.strftime('%Y%m%d')}"
                
                # Remove old position, add new one
                del self.active_positions[position_id]
                self.active_positions[new_position_id] = new_position
                
                # Record roll in history
                self._RecordRoll(position_id, new_position_id, trigger, roll_parameters, 
                               roll_execution)
                
                result["success"] = True
                result["pnl_impact"] = roll_execution["net_credit_debit"]
                result["new_position_id"] = new_position_id
                result["roll_details"] = roll_parameters
                
                self.algorithm.Log(f"Successfully rolled position {position_id} to {new_position_id}")
            
        except Exception as e:
            result["error"] = str(e)
            self.algorithm.Debug(f"Error rolling position {position_id}: {e}")
        
        return result

    def _FindOptimalRollParameters(self, position: RollingPosition, 
                                  roll_strategy: Dict) -> Optional[Dict]:
        """Find optimal parameters for rolling"""
        try:
            # Get next expiration cycles
            available_expirations = self._GetAvailableExpirations(position.symbol)
            
            # Filter by DTE preferences
            suitable_expirations = []
            for exp_date in available_expirations:
                dte = (exp_date - self.algorithm.Time).days
                if self.MIN_ROLL_DTE <= dte <= self.MAX_ROLL_DTE:
                    suitable_expirations.append((exp_date, dte))
            
            if not suitable_expirations:
                return None
            
            # Sort by preference (closest to target DTE)
            target_dte = self.roll_preferences[position.position_type]["preferred_dte"]
            suitable_expirations.sort(key=lambda x: abs(x[1] - target_dte))
            
            best_expiration = suitable_expirations[0][0]
            
            # Find optimal strikes
            strikes = self._FindOptimalRollStrikes(position, best_expiration, roll_strategy)
            
            if not strikes:
                return None
            
            return {
                "new_expiration": best_expiration,
                "new_strikes": strikes,
                "roll_direction": roll_strategy["direction"],
                "expected_credit": roll_strategy.get("target_credit", 0)
            }
            
        except Exception as e:
            self.algorithm.Debug(f"Error finding roll parameters: {e}")
            return None

    def _FindOptimalRollStrikes(self, position: RollingPosition, 
                               new_expiration: datetime, roll_strategy: Dict) -> Optional[List[float]]:
        """Find optimal strikes for the rolled position"""
        try:
            # Get current underlying price
            underlying_symbol = self._GetUnderlyingSymbol(position.symbol)
            current_price = self.algorithm.Securities[underlying_symbol].Price
            
            target_delta = self.roll_preferences[position.position_type]["delta_target"]
            
            if position.position_type == PositionType.STRANGLE:
                # For strangles, maintain similar delta on both sides
                put_strike = self._FindStrikeByDelta(position.symbol, new_expiration, 
                                                    -target_delta, 'Put')
                call_strike = self._FindStrikeByDelta(position.symbol, new_expiration, 
                                                     target_delta, 'Call')
                
                return [put_strike, call_strike] if put_strike and call_strike else None
                
            elif position.position_type == PositionType.IRON_CONDOR:
                # For iron condors, maintain similar probability ranges
                put_short = self._FindStrikeByDelta(position.symbol, new_expiration, 
                                                   -target_delta, 'Put')
                call_short = self._FindStrikeByDelta(position.symbol, new_expiration, 
                                                    target_delta, 'Call')
                
                # Set long strikes based on spread width
                spread_width = 50  # Standard $50 spread
                put_long = put_short - spread_width if put_short else None
                call_long = call_short + spread_width if call_short else None
                
                return [put_long, put_short, call_short, call_long] if all([put_long, put_short, call_short, call_long]) else None
            
            # Add other position types as needed
            
        except Exception as e:
            self.algorithm.Debug(f"Error finding roll strikes: {e}")
            
        return None

    def _ExecuteRollTrade(self, position: RollingPosition, roll_parameters: Dict) -> Dict[str, Any]:
        """Execute the actual roll trade"""
        result = {
            "success": False,
            "net_credit_debit": 0.0,
            "execution_details": {}
        }
        
        try:
            # Close existing position first
            close_orders = self._CreateCloseOrders(position)
            close_fills = []
            
            for order in close_orders:
                ticket = self.algorithm.MarketOrder(order["symbol"], order["quantity"], asynchronous=True)
                if ticket.Status == OrderStatus.Filled:
                    close_fills.append({
                        "symbol": order["symbol"],
                        "fill_price": ticket.AverageFillPrice,
                        "quantity": order["quantity"]
                    })
            
            # Calculate close proceeds
            close_proceeds = sum(fill["fill_price"] * fill["quantity"] for fill in close_fills)
            
            # Open new position
            new_orders = self._CreateNewPositionOrders(roll_parameters)
            new_fills = []
            
            for order in new_orders:
                ticket = self.algorithm.MarketOrder(order["symbol"], order["quantity"], asynchronous=True)
                if ticket.Status == OrderStatus.Filled:
                    new_fills.append({
                        "symbol": order["symbol"],
                        "fill_price": ticket.AverageFillPrice,
                        "quantity": order["quantity"]
                    })
            
            # Calculate new position cost
            new_cost = sum(fill["fill_price"] * fill["quantity"] for fill in new_fills)
            
            # Net credit/debit
            result["net_credit_debit"] = close_proceeds - new_cost
            result["success"] = len(close_fills) > 0 and len(new_fills) > 0
            result["execution_details"] = {
                "close_fills": close_fills,
                "new_fills": new_fills,
                "close_proceeds": close_proceeds,
                "new_cost": new_cost
            }
            
        except Exception as e:
            result["error"] = str(e)
            self.algorithm.Debug(f"Error executing roll trade: {e}")
        
        return result

    def GetPositionRollingSummary(self) -> Dict[str, Any]:
        """Get comprehensive rolling summary"""
        summary = {
            "total_active_positions": len(self.active_positions),
            "positions_near_21_dte": 0,
            "positions_at_profit_target": 0,
            "positions_at_loss_limit": 0,
            "total_theta_decay": 0.0,
            "total_delta_exposure": 0.0,
            "positions_by_type": {},
            "roll_history_count": len(self.roll_history),
            "average_roll_pnl": 0.0
        }
        
        # Analyze active positions
        for position in self.active_positions.values():
            # Count positions by status
            if position.days_to_expiration <= 21:
                summary["positions_near_21_dte"] += 1
            if position.profit_loss_percent >= 50:
                summary["positions_at_profit_target"] += 1
            if position.profit_loss_percent <= -200:
                summary["positions_at_loss_limit"] += 1
            
            # Aggregate exposures
            summary["total_theta_decay"] += position.theta_decay
            summary["total_delta_exposure"] += position.delta_exposure
            
            # Count by type
            pos_type = position.position_type.value
            if pos_type not in summary["positions_by_type"]:
                summary["positions_by_type"][pos_type] = 0
            summary["positions_by_type"][pos_type] += 1
        
        # Calculate average roll P&L
        if self.roll_history:
            total_pnl = sum(roll.get("pnl_impact", 0) for roll in self.roll_history)
            summary["average_roll_pnl"] = total_pnl / len(self.roll_history)
        
        return summary

    # Helper Methods
    def _CalculatePositionValue(self, position: RollingPosition) -> float:
        """Calculate current position value"""
        # Implementation would depend on QuantConnect's option pricing
        return 0.0

    def _CalculatePositionGreeks(self, position: RollingPosition) -> Dict[str, float]:
        """Calculate position Greeks"""
        return {"theta": 0.0, "delta": 0.0, "gamma": 0.0, "vega": 0.0}

    def _CalculateRollPriority(self, position: RollingPosition) -> int:
        """Calculate roll priority (1=immediate, 5=monitor)"""
        if position.days_to_expiration <= 7:
            return 1
        elif position.profit_loss_percent >= 75 or position.profit_loss_percent <= -150:
            return 2
        elif position.days_to_expiration <= 14:
            return 3
        elif position.profit_loss_percent >= 50 or position.profit_loss_percent <= -100:
            return 4
        else:
            return 5

    def _HasEarlyAssignmentRisk(self, position: RollingPosition) -> bool:
        """Check for early assignment risk"""
        # Simplified check - would need more sophisticated logic
        return position.days_to_expiration <= 5 and any(strike < 0 for strike in position.strikes)

    def _DetermineRollStrategy(self, position: RollingPosition, trigger: RollTrigger) -> Dict:
        """Determine the appropriate roll strategy"""
        if trigger == RollTrigger.DTE_21:
            return {"direction": RollDirection.FORWARD, "maintain_strikes": True}
        elif trigger == RollTrigger.PROFIT_TARGET:
            return {"direction": RollDirection.FORWARD, "take_profit": True}
        elif trigger == RollTrigger.LOSS_LIMIT:
            return {"direction": RollDirection.FORWARD, "reduce_risk": True}
        elif trigger == RollTrigger.VOLATILITY_SPIKE:
            return {"direction": RollDirection.FORWARD, "target_credit": True}
        else:
            return {"direction": RollDirection.FORWARD}

    def _GetAvailableExpirations(self, symbol: str) -> List[datetime]:
        """Get available expiration dates"""
        # Implementation would query QuantConnect for available expirations
        return []

    def _GetUnderlyingSymbol(self, option_symbol: str) -> str:
        """Extract underlying symbol from option symbol"""
        # Implementation depends on QuantConnect symbol format
        return "SPY"  # Placeholder

    def _FindStrikeByDelta(self, symbol: str, expiration: datetime, 
                          target_delta: float, option_right) -> Optional[float]:
        """Find strike price by target delta"""
        # Implementation would use QuantConnect's option chain
        return None

    def _CreateCloseOrders(self, position: RollingPosition) -> List[Dict]:
        """Create orders to close existing position"""
        return []

    def _CreateNewPositionOrders(self, roll_parameters: Dict) -> List[Dict]:
        """Create orders for new position"""
        return []

    def _CreateRolledPosition(self, old_position: RollingPosition, 
                            roll_parameters: Dict, execution: Dict) -> RollingPosition:
        """Create new position object from roll"""
        return old_position  # Placeholder

    def _RecordRoll(self, old_id: str, new_id: str, trigger: RollTrigger, 
                   parameters: Dict, execution: Dict) -> None:
        """Record roll in history"""
        self.roll_history.append({
            "timestamp": self.algorithm.Time,
            "old_position_id": old_id,
            "new_position_id": new_id,
            "trigger": trigger.value,
            "parameters": parameters,
            "pnl_impact": execution.get("net_credit_debit", 0)
        })

    def _ShouldCloseInsteadOfRoll(self, position: RollingPosition, trigger: RollTrigger) -> bool:
        """Determine if position should be closed instead of rolled"""
        return trigger == RollTrigger.LOSS_LIMIT and position.profit_loss_percent <= -300

    def _ClosePosition(self, position_id: str, position: RollingPosition) -> Dict[str, Any]:
        """Close position entirely"""
        result = {"success": False, "pnl_impact": 0.0}
        
        try:
            # Implementation would close all position legs
            del self.active_positions[position_id]
            result["success"] = True
        except Exception as e:
            result["error"] = str(e)
            
        return result

    def _calculate_theoretical_value(self, symbol: str, strike: float, 
                                    expiration: datetime, option_right) -> float:
        """Calculate theoretical option value using Black-Scholes"""
        try:
            from math import sqrt, log, exp
            from scipy.stats import norm
            
            underlying_price = self.algorithm.Securities[symbol].Price
            dte = max(0.001, (expiration - self.algorithm.Time).days / 365.0)
            
            # Get IV or use default
            iv = 0.20  # Default 20% IV
            if hasattr(self.algorithm, 'implied_volatility'):
                iv_data = self.algorithm.implied_volatility.get(symbol)
                if iv_data and iv_data.Current.Value > 0:
                    iv = iv_data.Current.Value
            
            r = 0.05  # Risk-free rate
            
            # Black-Scholes formula
            d1 = (log(underlying_price / strike) + (r + 0.5 * iv ** 2) * dte) / (iv * sqrt(dte))
            d2 = d1 - iv * sqrt(dte)
            
            if str(option_right) == 'Call' or hasattr(option_right, 'Call'):
                theoretical_value = (underlying_price * norm.cdf(d1) - 
                                   strike * exp(-r * dte) * norm.cdf(d2))
            else:  # Put
                theoretical_value = (strike * exp(-r * dte) * norm.cdf(-d2) - 
                                   underlying_price * norm.cdf(-d1))
            
            # Ensure non-negative and reasonable
            return max(0.01, min(theoretical_value, underlying_price * 0.5))
            
        except Exception as e:
            self.algorithm.Debug(f"Error in Black-Scholes calculation: {str(e)}")
            # Fallback to intrinsic + time value estimate
            underlying_price = self.algorithm.Securities[symbol].Price
            intrinsic = max(0, underlying_price - strike) if (str(option_right) == 'Call' or hasattr(option_right, 'Call')) else max(0, strike - underlying_price)
            time_value = underlying_price * 0.01 * sqrt((expiration - self.algorithm.Time).days / 365.0)
            return max(0.01, intrinsic + time_value)
    
    def AddPosition(self, symbol: str, position_type: PositionType, 
                   entry_date: datetime, expiration_date: datetime,
                   strikes: List[float], contracts: List[int], 
                   entry_price: float) -> str:
        """Add new position for tracking"""
        position_id = f"{symbol}_{expiration_date.strftime('%Y%m%d')}_{int(self.algorithm.Time.timestamp())}"
        
        position = RollingPosition(
            symbol=symbol,
            position_type=position_type,
            entry_date=entry_date,
            expiration_date=expiration_date,
            strikes=strikes,
            contracts=contracts,
            entry_price=entry_price,
            current_price=entry_price,
            days_to_expiration=(expiration_date - entry_date).days,
            profit_loss_percent=0.0,
            theta_decay=0.0,
            delta_exposure=0.0,
            gamma_risk=0.0,
            vega_exposure=0.0,
            max_loss=entry_price * 2.0,
            roll_priority=5
        )
        
        self.active_positions[position_id] = position
        return position_id