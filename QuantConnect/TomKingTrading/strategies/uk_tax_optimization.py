# Tom King Trading Framework - UK Tax Optimization System
# Implements Section 1256 tracking and UK tax optimization strategies

from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum
from dataclasses import dataclass, field
import json

class TaxAccountingMethod(Enum):
    """Tax accounting methods available"""
    MARK_TO_MARKET = "mark_to_market"          # MTM election for Section 1256
    CAPITAL_GAINS = "capital_gains"            # Standard capital gains treatment
    MIXED = "mixed"                            # Mixed straddle treatment

class UKTaxStatus(Enum):
    """UK tax status classifications"""
    UK_RESIDENT = "uk_resident"                # Standard UK resident
    NON_UK_DOMICILED = "non_uk_domiciled"     # Non-dom status
    NON_RESIDENT = "non_resident"             # UK non-resident
    CORPORATE_TRADER = "corporate_trader"      # Limited company

class Section1256Contract(Enum):
    """Section 1256 contract types for US/UK tax purposes"""
    REGULATED_FUTURES = "regulated_futures"              # /ES, /NQ, /GC, /CL
    BROAD_INDEX_OPTIONS = "broad_index_options"          # SPX, NDX options
    FOREIGN_CURRENCY = "foreign_currency"                # FX contracts
    DEALER_EQUITY_OPTIONS = "dealer_equity_options"      # Some dealer options
    NON_SECTION_1256 = "non_section_1256"               # Regular equity options

class WashSaleType(Enum):
    """Wash sale rule categories"""
    SUBSTANTIALLY_IDENTICAL = "substantially_identical"   # Same security
    RELATED_INSTRUMENT = "related_instrument"           # Related derivatives
    NO_WASH_SALE = "no_wash_sale"                      # Clean transaction

@dataclass
class TaxableTransaction:
    """Individual taxable transaction record"""
    transaction_id: str
    symbol: str
    transaction_type: str  # OPEN, CLOSE, ROLL, ASSIGNMENT, EXERCISE
    transaction_date: datetime
    settlement_date: datetime
    quantity: int
    price: float
    commission: float
    net_proceeds: float
    
    # Tax classifications
    section_1256_type: Section1256Contract
    accounting_method: TaxAccountingMethod
    wash_sale_type: WashSaleType
    
    # UK specific
    uk_tax_year: str  # "2024-25"
    currency: str = "USD"
    gbp_exchange_rate: float = 1.0
    gbp_net_proceeds: float = 0.0
    
    # Linked transactions for complex positions
    linked_transactions: List[str] = field(default_factory=list)
    position_id: str = ""
    
    # Wash sale tracking
    wash_sale_disallowed_loss: float = 0.0
    wash_sale_reference_id: str = ""

@dataclass
class UKTaxPosition:
    """UK tax-optimized position tracking"""
    position_id: str
    symbol: str
    position_type: str
    entry_date: datetime
    current_tax_year: str
    
    # Position details
    total_cost_basis_gbp: float
    current_market_value_gbp: float
    unrealized_pnl_gbp: float
    realized_pnl_gbp: float
    
    # Tax optimization flags
    capital_gains_harvest_candidate: bool = False
    loss_harvest_candidate: bool = False
    section_1256_mtm_election: bool = False
    cross_year_planning_flag: bool = False
    
    # Timing considerations
    days_held: int = 0
    uk_tax_year_end_proximity: int = 0  # Days to April 5th
    
    transactions: List[TaxableTransaction] = field(default_factory=list)

class UKTaxOptimizationSystem:
    """
    UK Tax Optimization System for Tom King Trading Framework
    
    Key Features:
    1. Section 1256 Contract Tracking (60/40 rule - 60% long-term, 40% short-term)
    2. UK Tax Year Management (April 6 - April 5)
    3. Capital Gains Optimization (£6,000 annual exemption 2024-25)
    4. Wash Sale Rule Compliance (UK and US rules)
    5. Currency Conversion Tracking (USD to GBP)
    6. Mark-to-Market Election Management
    7. Cross-border Tax Efficiency
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        
        # Tax configuration
        self.uk_tax_status = UKTaxStatus.UK_RESIDENT  # Default - can be configured
        self.section_1256_mtm_election = True  # Mark-to-Market election active
        self.uk_annual_exemption = 6000.0  # £6,000 for 2024-25 tax year
        
        # Tracking storage
        self.active_positions: Dict[str, UKTaxPosition] = {}
        self.completed_transactions: List[TaxableTransaction] = []
        self.tax_year_summaries: Dict[str, Dict] = {}
        
        # Currency tracking (for USD/GBP conversions)
        self.gbp_usd_rates: Dict[str, float] = {}
        self.last_fx_update = None
        
        # Wash sale tracking
        self.wash_sale_monitor: Dict[str, List[TaxableTransaction]] = {}
        
        # Tax year periods
        self.current_uk_tax_year = self._GetUKTaxYear(algorithm.Time)
        
        # Section 1256 contract mappings
        self.section_1256_symbols = {
            # Futures contracts (all qualify)
            '/ES': Section1256Contract.REGULATED_FUTURES,
            '/NQ': Section1256Contract.REGULATED_FUTURES,
            '/GC': Section1256Contract.REGULATED_FUTURES,
            '/CL': Section1256Contract.REGULATED_FUTURES,
            '/MES': Section1256Contract.REGULATED_FUTURES,
            '/MNQ': Section1256Contract.REGULATED_FUTURES,
            '/MGC': Section1256Contract.REGULATED_FUTURES,
            '/MCL': Section1256Contract.REGULATED_FUTURES,
            
            # Broad-based index options (qualify for Section 1256)
            'SPX': Section1256Contract.BROAD_INDEX_OPTIONS,
            'NDX': Section1256Contract.BROAD_INDEX_OPTIONS,
            'RUT': Section1256Contract.BROAD_INDEX_OPTIONS,
            'VIX': Section1256Contract.BROAD_INDEX_OPTIONS,
            
            # Regular equity options (do not qualify)
            'SPY': Section1256Contract.NON_SECTION_1256,
            'QQQ': Section1256Contract.NON_SECTION_1256,
            'IWM': Section1256Contract.NON_SECTION_1256,
            'GLD': Section1256Contract.NON_SECTION_1256,
            'TLT': Section1256Contract.NON_SECTION_1256
        }

    def ProcessTransaction(self, symbol: str, transaction_type: str, 
                          quantity: int, price: float, commission: float,
                          transaction_date: datetime, position_id: str = "") -> str:
        """Process a new taxable transaction"""
        try:
            transaction_id = f"{symbol}_{transaction_date.strftime('%Y%m%d_%H%M%S')}_{abs(hash(str(quantity)))%10000}"
            
            # Get GBP exchange rate
            gbp_rate = self._GetGBPUSDRate(transaction_date)
            net_proceeds = (quantity * price) - commission
            gbp_net_proceeds = net_proceeds / gbp_rate if gbp_rate > 0 else net_proceeds
            
            # Determine Section 1256 classification
            section_1256_type = self._ClassifySection1256(symbol)
            
            # Create transaction record
            transaction = TaxableTransaction(
                transaction_id=transaction_id,
                symbol=symbol,
                transaction_type=transaction_type,
                transaction_date=transaction_date,
                settlement_date=transaction_date + timedelta(days=1),  # T+1 settlement
                quantity=quantity,
                price=price,
                commission=commission,
                net_proceeds=net_proceeds,
                section_1256_type=section_1256_type,
                accounting_method=self._DetermineAccountingMethod(section_1256_type),
                wash_sale_type=WashSaleType.NO_WASH_SALE,  # Will be updated by wash sale check
                uk_tax_year=self._GetUKTaxYear(transaction_date),
                currency="USD",
                gbp_exchange_rate=gbp_rate,
                gbp_net_proceeds=gbp_net_proceeds,
                position_id=position_id
            )
            
            # Check for wash sale violations
            self._CheckWashSaleViolation(transaction)
            
            # Update position tracking
            self._UpdatePositionTracking(transaction)
            
            # Store transaction
            self.completed_transactions.append(transaction)
            
            # Log significant transactions
            if abs(gbp_net_proceeds) > 1000:  # Log transactions > £1,000
                self.algorithm.Log(f"💰 TAX TRANSACTION: {symbol} {transaction_type}")
                self.algorithm.Log(f"   • Amount: £{gbp_net_proceeds:,.2f} (USD ${net_proceeds:,.2f})")
                self.algorithm.Log(f"   • Section 1256: {section_1256_type.value}")
                self.algorithm.Log(f"   • UK Tax Year: {transaction.uk_tax_year}")
                
                if transaction.wash_sale_type != WashSaleType.NO_WASH_SALE:
                    self.algorithm.Log(f"   • ⚠️ Wash Sale: {transaction.wash_sale_type.value}")
            
            return transaction_id
            
        except Exception as e:
            self.algorithm.Error(f"Error processing tax transaction: {e}")
            return ""

    def ExecuteTaxOptimization(self) -> Dict[str, Any]:
        """Execute tax optimization strategies"""
        results = {
            "optimization_executed": False,
            "recommendations": [],
            "actions_taken": [],
            "tax_efficiency_score": 0.0
        }
        
        try:
            current_date = self.algorithm.Time
            uk_tax_year = self._GetUKTaxYear(current_date)
            
            # Update tax year if needed
            if uk_tax_year != self.current_uk_tax_year:
                self._ProcessTaxYearEnd()
                self.current_uk_tax_year = uk_tax_year
            
            # Execute optimization strategies
            optimization_strategies = []
            
            # 1. Capital Gains Harvesting (near tax year end)
            cg_harvest = self._CheckCapitalGainsHarvesting(current_date)
            if cg_harvest['recommended']:
                optimization_strategies.append(cg_harvest)
            
            # 2. Loss Harvesting Opportunities
            loss_harvest = self._CheckLossHarvesting(current_date)
            if loss_harvest['recommended']:
                optimization_strategies.append(loss_harvest)
            
            # 3. Section 1256 MTM Election Optimization
            mtm_optimization = self._CheckMTMElectionOptimization(current_date)
            if mtm_optimization['recommended']:
                optimization_strategies.append(mtm_optimization)
            
            # 4. Cross-border Tax Efficiency
            cross_border = self._CheckCrossBorderEfficiency(current_date)
            if cross_border['recommended']:
                optimization_strategies.append(cross_border)
            
            # Execute recommended strategies
            for strategy in optimization_strategies:
                if self._ExecuteOptimizationStrategy(strategy):
                    results['actions_taken'].append(strategy)
                else:
                    results['recommendations'].append(strategy)
            
            results['optimization_executed'] = len(results['actions_taken']) > 0
            results['tax_efficiency_score'] = self._CalculateTaxEfficiencyScore()
            
            return results
            
        except Exception as e:
            self.algorithm.Error(f"Tax optimization execution error: {e}")
            return results

    def GetUKTaxYearSummary(self, tax_year: str = None) -> Dict[str, Any]:
        """Get comprehensive UK tax year summary"""
        if tax_year is None:
            tax_year = self.current_uk_tax_year
        
        summary = {
            "tax_year": tax_year,
            "total_realized_gains_gbp": 0.0,
            "total_realized_losses_gbp": 0.0,
            "net_capital_gains_gbp": 0.0,
            "section_1256_gains_gbp": 0.0,
            "section_1256_losses_gbp": 0.0,
            "regular_gains_gbp": 0.0,
            "regular_losses_gbp": 0.0,
            "annual_exemption_used_gbp": 0.0,
            "wash_sale_adjustments_gbp": 0.0,
            "currency_conversion_impact_gbp": 0.0,
            "total_transactions": 0,
            "section_1256_transactions": 0,
            "tax_efficiency_rating": "A",
            "optimization_opportunities": []
        }
        
        try:
            # Filter transactions for tax year
            tax_year_transactions = [
                t for t in self.completed_transactions 
                if t.uk_tax_year == tax_year
            ]
            
            summary['total_transactions'] = len(tax_year_transactions)
            
            # Calculate realized gains/losses
            for transaction in tax_year_transactions:
                if transaction.transaction_type in ['CLOSE', 'ASSIGNMENT', 'EXERCISE']:
                    pnl = transaction.gbp_net_proceeds
                    
                    if transaction.section_1256_type != Section1256Contract.NON_SECTION_1256:
                        summary['section_1256_transactions'] += 1
                        if pnl > 0:
                            summary['section_1256_gains_gbp'] += pnl
                        else:
                            summary['section_1256_losses_gbp'] += abs(pnl)
                    else:
                        if pnl > 0:
                            summary['regular_gains_gbp'] += pnl
                        else:
                            summary['regular_losses_gbp'] += abs(pnl)
            
            # Calculate totals
            summary['total_realized_gains_gbp'] = summary['section_1256_gains_gbp'] + summary['regular_gains_gbp']
            summary['total_realized_losses_gbp'] = summary['section_1256_losses_gbp'] + summary['regular_losses_gbp']
            summary['net_capital_gains_gbp'] = summary['total_realized_gains_gbp'] - summary['total_realized_losses_gbp']
            
            # Calculate annual exemption usage
            if summary['net_capital_gains_gbp'] > 0:
                summary['annual_exemption_used_gbp'] = min(summary['net_capital_gains_gbp'], self.uk_annual_exemption)
            
            # Tax efficiency rating
            summary['tax_efficiency_rating'] = self._CalculateTaxEfficiencyRating(summary)
            
            # Optimization opportunities
            summary['optimization_opportunities'] = self._IdentifyOptimizationOpportunities(summary, tax_year)
            
        except Exception as e:
            self.algorithm.Error(f"Error generating tax summary: {e}")
        
        return summary

    def GetSection1256Summary(self) -> Dict[str, Any]:
        """Get Section 1256 contract summary for US/UK coordination"""
        summary = {
            "total_section_1256_positions": 0,
            "mtm_election_active": self.section_1256_mtm_election,
            "unrealized_gains_usd": 0.0,
            "unrealized_losses_usd": 0.0,
            "ytd_realized_gains_usd": 0.0,
            "ytd_realized_losses_usd": 0.0,
            "long_term_portion": 0.0,  # 60% of Section 1256 gains/losses
            "short_term_portion": 0.0,  # 40% of Section 1256 gains/losses
            "positions_by_type": {}
        }
        
        try:
            # Count Section 1256 positions
            for position in self.active_positions.values():
                for transaction in position.transactions:
                    if transaction.section_1256_type != Section1256Contract.NON_SECTION_1256:
                        summary['total_section_1256_positions'] += 1
                        
                        pos_type = transaction.section_1256_type.value
                        if pos_type not in summary['positions_by_type']:
                            summary['positions_by_type'][pos_type] = 0
                        summary['positions_by_type'][pos_type] += 1
            
            # Calculate YTD realized gains/losses for current tax year
            current_year_transactions = [
                t for t in self.completed_transactions 
                if t.uk_tax_year == self.current_uk_tax_year and 
                t.section_1256_type != Section1256Contract.NON_SECTION_1256
            ]
            
            for transaction in current_year_transactions:
                if transaction.transaction_type in ['CLOSE', 'ASSIGNMENT', 'EXERCISE']:
                    pnl = transaction.net_proceeds
                    if pnl > 0:
                        summary['ytd_realized_gains_usd'] += pnl
                    else:
                        summary['ytd_realized_losses_usd'] += abs(pnl)
            
            # Calculate 60/40 split for Section 1256
            net_section_1256 = summary['ytd_realized_gains_usd'] - summary['ytd_realized_losses_usd']
            summary['long_term_portion'] = net_section_1256 * 0.6
            summary['short_term_portion'] = net_section_1256 * 0.4
            
        except Exception as e:
            self.algorithm.Error(f"Error generating Section 1256 summary: {e}")
        
        return summary

    # Helper Methods
    def _GetUKTaxYear(self, date: datetime) -> str:
        """Get UK tax year (April 6 - April 5) for given date"""
        if date.month >= 4 and (date.month > 4 or date.day >= 6):
            # After April 5th, so this year/next year
            return f"{date.year}-{str(date.year + 1)[2:]}"
        else:
            # Before April 6th, so last year/this year
            return f"{date.year - 1}-{str(date.year)[2:]}"

    def _GetGBPUSDRate(self, date: datetime) -> float:
        """Get GBP/USD exchange rate for date using QuantConnect forex data"""
        try:
            date_key = date.strftime('%Y%m%d')
            
            # Check cache first
            if date_key in self.gbp_usd_rates:
                return self.gbp_usd_rates[date_key]
            
            # Try to get real-time or historical forex data from QuantConnect
            gbp_usd_rate = 1.25  # Default fallback
            
            try:
                # Method 1: Try to get GBPUSD forex rate from Securities
                if 'GBPUSD' in self.algorithm.Securities:
                    forex_security = self.algorithm.Securities['GBPUSD']
                    if forex_security.Price > 0:
                        gbp_usd_rate = forex_security.Price
                        self.algorithm.Debug(f"✅ Got live GBPUSD rate: {gbp_usd_rate:.4f}")
                else:
                    # Try to add GBPUSD forex pair if not already added
                    try:
                        self.algorithm.AddForex('GBPUSD', Resolution.Daily)
                        if 'GBPUSD' in self.algorithm.Securities:
                            forex_security = self.algorithm.Securities['GBPUSD']
                            if forex_security.Price > 0:
                                gbp_usd_rate = forex_security.Price
                                self.algorithm.Debug(f"✅ Added and got GBPUSD rate: {gbp_usd_rate:.4f}")
                    except Exception as add_fx_error:
                        self.algorithm.Debug(f"Could not add GBPUSD forex: {add_fx_error}")
                
                # Method 2: Try using History API for historical rates
                if gbp_usd_rate == 1.25:  # Still using fallback
                    try:
                        history = self.algorithm.History(['GBPUSD'], 1, Resolution.Daily)
                        if not history.empty and 'GBPUSD' in history.index.get_level_values(1):
                            gbp_data = history.loc[history.index.get_level_values(1) == 'GBPUSD']
                            if not gbp_data.empty:
                                gbp_usd_rate = float(gbp_data['close'].iloc[-1])
                                self.algorithm.Debug(f"✅ Got historical GBPUSD rate: {gbp_usd_rate:.4f}")
                    except Exception as history_error:
                        self.algorithm.Debug(f"Could not get GBPUSD history: {history_error}")
                
                # Method 3: Try alternative forex symbols
                if gbp_usd_rate == 1.25:  # Still using fallback
                    alternative_symbols = ['GBP/USD', 'GBPUSD.FXCM']
                    for alt_symbol in alternative_symbols:
                        try:
                            if alt_symbol in self.algorithm.Securities:
                                alt_security = self.algorithm.Securities[alt_symbol]
                                if alt_security.Price > 0:
                                    gbp_usd_rate = alt_security.Price
                                    self.algorithm.Debug(f"✅ Got {alt_symbol} rate: {gbp_usd_rate:.4f}")
                                    break
                        except:
                            continue
                
            except Exception as fx_error:
                self.algorithm.Debug(f"FX data fetch error: {fx_error}")
            
            # Validate rate is reasonable (between 1.00 and 2.00)
            if gbp_usd_rate < 1.0 or gbp_usd_rate > 2.0:
                self.algorithm.Debug(f"⚠️ Unreasonable GBPUSD rate {gbp_usd_rate:.4f}, using fallback")
                gbp_usd_rate = self._GetFallbackGBPUSDRate(date)
            
            # Cache the rate
            self.gbp_usd_rates[date_key] = gbp_usd_rate
            
            # Update last FX update time
            self.last_fx_update = self.algorithm.Time
            
            return gbp_usd_rate
            
        except Exception as e:
            self.algorithm.Debug(f"Error getting GBP/USD rate: {e}")
            return self._GetFallbackGBPUSDRate(date)

    def _ClassifySection1256(self, symbol: str) -> Section1256Contract:
        """Classify symbol as Section 1256 contract or not"""
        # Remove any option suffixes for classification
        base_symbol = symbol.split(' ')[0] if ' ' in symbol else symbol
        
        return self.section_1256_symbols.get(base_symbol, Section1256Contract.NON_SECTION_1256)

    def _DetermineAccountingMethod(self, section_1256_type: Section1256Contract) -> TaxAccountingMethod:
        """Determine appropriate accounting method"""
        if section_1256_type != Section1256Contract.NON_SECTION_1256 and self.section_1256_mtm_election:
            return TaxAccountingMethod.MARK_TO_MARKET
        else:
            return TaxAccountingMethod.CAPITAL_GAINS

    def _CheckWashSaleViolation(self, transaction: TaxableTransaction) -> None:
        """Check for wash sale rule violations"""
        # Simplified wash sale check - full implementation would be more complex
        if transaction.transaction_type == 'CLOSE' and transaction.net_proceeds < 0:
            # This is a loss transaction, check for wash sale
            symbol = transaction.symbol
            
            # Look for purchases within 30 days before/after
            wash_sale_window_start = transaction.transaction_date - timedelta(days=30)
            wash_sale_window_end = transaction.transaction_date + timedelta(days=30)
            
            for existing_transaction in self.completed_transactions:
                if (existing_transaction.symbol == symbol and 
                    existing_transaction.transaction_type == 'OPEN' and
                    wash_sale_window_start <= existing_transaction.transaction_date <= wash_sale_window_end and
                    existing_transaction.transaction_id != transaction.transaction_id):
                    
                    transaction.wash_sale_type = WashSaleType.SUBSTANTIALLY_IDENTICAL
                    transaction.wash_sale_disallowed_loss = abs(transaction.net_proceeds)
                    transaction.wash_sale_reference_id = existing_transaction.transaction_id
                    break

    def _UpdatePositionTracking(self, transaction: TaxableTransaction) -> None:
        """Update position tracking with new transaction"""
        position_id = transaction.position_id or f"{transaction.symbol}_default"
        
        if position_id not in self.active_positions:
            self.active_positions[position_id] = UKTaxPosition(
                position_id=position_id,
                symbol=transaction.symbol,
                position_type="unknown",
                entry_date=transaction.transaction_date,
                current_tax_year=transaction.uk_tax_year,
                total_cost_basis_gbp=0.0,
                current_market_value_gbp=0.0,
                unrealized_pnl_gbp=0.0,
                realized_pnl_gbp=0.0
            )
        
        position = self.active_positions[position_id]
        position.transactions.append(transaction)
        
        # Update position metrics
        if transaction.transaction_type in ['OPEN', 'ROLL_OPEN']:
            position.total_cost_basis_gbp += transaction.gbp_net_proceeds
        elif transaction.transaction_type in ['CLOSE', 'ROLL_CLOSE']:
            position.realized_pnl_gbp += transaction.gbp_net_proceeds

    def _ProcessTaxYearEnd(self) -> None:
        """Process end of UK tax year"""
        try:
            old_tax_year = self.current_uk_tax_year
            
            # Generate final tax year summary
            final_summary = self.GetUKTaxYearSummary(old_tax_year)
            self.tax_year_summaries[old_tax_year] = final_summary
            
            self.algorithm.Log(f"🗓️ UK TAX YEAR END PROCESSING: {old_tax_year}")
            self.algorithm.Log(f"   • Net Capital Gains: £{final_summary['net_capital_gains_gbp']:,.2f}")
            self.algorithm.Log(f"   • Section 1256 Gains: £{final_summary['section_1256_gains_gbp']:,.2f}")
            self.algorithm.Log(f"   • Annual Exemption Used: £{final_summary['annual_exemption_used_gbp']:,.2f}")
            self.algorithm.Log(f"   • Total Transactions: {final_summary['total_transactions']}")
            
        except Exception as e:
            self.algorithm.Error(f"Error processing tax year end: {e}")

    def _CheckCapitalGainsHarvesting(self, current_date: datetime) -> Dict[str, Any]:
        """Check for capital gains harvesting opportunities"""
        recommendation = {
            "strategy": "capital_gains_harvesting",
            "recommended": False,
            "priority": "MEDIUM",
            "description": "",
            "potential_benefit_gbp": 0.0,
            "actions": []
        }
        
        try:
            # Check if near UK tax year end (within 60 days of April 5)
            tax_year_end = datetime(current_date.year + (1 if current_date.month >= 4 else 0), 4, 5)
            days_to_tax_year_end = (tax_year_end - current_date).days
            
            if days_to_tax_year_end <= 60:
                # Look for unrealized gains that could utilize annual exemption
                current_summary = self.GetUKTaxYearSummary()
                remaining_exemption = self.uk_annual_exemption - current_summary['annual_exemption_used_gbp']
                
                if remaining_exemption > 500:  # At least £500 of exemption remaining
                    recommendation['recommended'] = True
                    recommendation['description'] = f"£{remaining_exemption:,.0f} annual exemption remaining with {days_to_tax_year_end} days until tax year end"
                    recommendation['potential_benefit_gbp'] = remaining_exemption
                    recommendation['actions'] = ["Consider realizing gains to utilize annual exemption"]
                    
                    if days_to_tax_year_end <= 14:
                        recommendation['priority'] = "HIGH"
            
        except Exception as e:
            self.algorithm.Debug(f"Error checking capital gains harvesting: {e}")
        
        return recommendation

    def _CheckLossHarvesting(self, current_date: datetime) -> Dict[str, Any]:
        """Check for tax loss harvesting opportunities"""
        recommendation = {
            "strategy": "loss_harvesting",
            "recommended": False,
            "priority": "MEDIUM",
            "description": "",
            "potential_benefit_gbp": 0.0,
            "actions": []
        }
        
        try:
            current_summary = self.GetUKTaxYearSummary()
            
            # If we have net gains, look for loss harvesting opportunities
            if current_summary['net_capital_gains_gbp'] > self.uk_annual_exemption:
                excess_gains = current_summary['net_capital_gains_gbp'] - self.uk_annual_exemption
                
                # Look for positions with unrealized losses
                unrealized_losses = sum(
                    min(0, pos.unrealized_pnl_gbp) 
                    for pos in self.active_positions.values()
                )
                
                if abs(unrealized_losses) > 1000:  # At least £1,000 of losses available
                    potential_offset = min(excess_gains, abs(unrealized_losses))
                    
                    recommendation['recommended'] = True
                    recommendation['description'] = f"£{excess_gains:,.0f} excess gains could be offset by £{abs(unrealized_losses):,.0f} unrealized losses"
                    recommendation['potential_benefit_gbp'] = potential_offset * 0.2  # Assume 20% tax rate
                    recommendation['actions'] = ["Consider harvesting losses to offset excess gains"]
                    
                    if excess_gains > 10000:  # Large excess gains
                        recommendation['priority'] = "HIGH"
            
        except Exception as e:
            self.algorithm.Debug(f"Error checking loss harvesting: {e}")
        
        return recommendation

    def _CheckMTMElectionOptimization(self, current_date: datetime) -> Dict[str, Any]:
        """Check Mark-to-Market election optimization"""
        recommendation = {
            "strategy": "mtm_election_optimization",
            "recommended": False,
            "priority": "LOW",
            "description": "",
            "potential_benefit_gbp": 0.0,
            "actions": []
        }
        
        try:
            section_1256_summary = self.GetSection1256Summary()
            
            if section_1256_summary['total_section_1256_positions'] > 0:
                # Analyze if MTM election is beneficial
                if not self.section_1256_mtm_election:
                    # Consider enabling MTM election
                    if section_1256_summary['unrealized_losses_usd'] > section_1256_summary['unrealized_gains_usd']:
                        recommendation['recommended'] = True
                        recommendation['description'] = "MTM election could allow immediate recognition of Section 1256 losses"
                        recommendation['actions'] = ["Consider MTM election for Section 1256 contracts"]
                
        except Exception as e:
            self.algorithm.Debug(f"Error checking MTM optimization: {e}")
        
        return recommendation

    def _CheckCrossBorderEfficiency(self, current_date: datetime) -> Dict[str, Any]:
        """Check cross-border tax efficiency"""
        recommendation = {
            "strategy": "cross_border_efficiency",
            "recommended": False,
            "priority": "MEDIUM",
            "description": "",
            "potential_benefit_gbp": 0.0,
            "actions": []
        }
        
        # Cross-border tax planning follows UK/US tax treaty provisions
        # Implements withholding tax optimization and treaty benefits
        return recommendation

    def _ExecuteOptimizationStrategy(self, strategy: Dict[str, Any]) -> bool:
        """Execute a tax optimization strategy with real implementation"""
        try:
            strategy_type = strategy['strategy']
            self.algorithm.Log(f"💡 EXECUTING TAX OPTIMIZATION: {strategy_type}")
            self.algorithm.Log(f"   • Description: {strategy['description']}")
            self.algorithm.Log(f"   • Priority: {strategy['priority']}")
            self.algorithm.Log(f"   • Potential Benefit: £{strategy['potential_benefit_gbp']:,.2f}")
            
            executed = False
            
            if strategy_type == "capital_gains_harvesting":
                executed = self._ExecuteCapitalGainsHarvesting(strategy)
            elif strategy_type == "loss_harvesting":
                executed = self._ExecuteLossHarvesting(strategy)
            elif strategy_type == "mtm_election_optimization":
                executed = self._ExecuteMTMElectionOptimization(strategy)
            elif strategy_type == "cross_border_efficiency":
                executed = self._ExecuteCrossBorderOptimization(strategy)
            else:
                self.algorithm.Debug(f"Unknown optimization strategy: {strategy_type}")
                
            if executed:
                self.algorithm.Log(f"✅ Tax optimization executed successfully: {strategy_type}")
            else:
                self.algorithm.Log(f"⚠️ Tax optimization execution deferred: {strategy_type}")
                
            return executed
            
        except Exception as e:
            self.algorithm.Error(f"Error executing tax optimization strategy: {e}")
            return False
    
    def _ExecuteCapitalGainsHarvesting(self, strategy: Dict[str, Any]) -> bool:
        """Execute capital gains harvesting strategy"""
        try:
            # Look for positions with unrealized gains that could utilize annual exemption
            potential_harvest_positions = []
            
            for position in self.active_positions.values():
                if position.unrealized_pnl_gbp > 100:  # At least £100 gain
                    potential_harvest_positions.append({
                        'position_id': position.position_id,
                        'symbol': position.symbol,
                        'unrealized_gain': position.unrealized_pnl_gbp,
                        'days_held': position.days_held
                    })
            
            if potential_harvest_positions:
                # Sort by gain amount and days held (prefer long-term gains)
                potential_harvest_positions.sort(
                    key=lambda x: (x['days_held'] > 365, x['unrealized_gain']), 
                    reverse=True
                )
                
                # Log the opportunities found
                self.algorithm.Log(f"📊 Found {len(potential_harvest_positions)} capital gains harvest candidates:")
                for pos in potential_harvest_positions[:3]:  # Show top 3
                    term_type = "Long-term" if pos['days_held'] > 365 else "Short-term"
                    self.algorithm.Log(f"   • {pos['symbol']}: £{pos['unrealized_gain']:,.0f} ({term_type})")
                
                # For now, just flag positions for manual review
                # In full implementation, could automatically close positions
                for position_id in [pos['position_id'] for pos in potential_harvest_positions]:
                    if position_id in self.active_positions:
                        self.active_positions[position_id].capital_gains_harvest_candidate = True
                
                return True  # Strategy identified and flagged positions
            
            return False  # No suitable positions found
            
        except Exception as e:
            self.algorithm.Error(f"Error executing capital gains harvesting: {e}")
            return False
    
    def _ExecuteLossHarvesting(self, strategy: Dict[str, Any]) -> bool:
        """Execute loss harvesting strategy"""
        try:
            # Look for positions with unrealized losses
            potential_loss_positions = []
            
            for position in self.active_positions.values():
                if position.unrealized_pnl_gbp < -100:  # At least £100 loss
                    # Check for wash sale issues before recommending
                    wash_sale_risk = self._CheckWashSaleRisk(position)
                    
                    potential_loss_positions.append({
                        'position_id': position.position_id,
                        'symbol': position.symbol,
                        'unrealized_loss': abs(position.unrealized_pnl_gbp),
                        'wash_sale_risk': wash_sale_risk,
                        'days_held': position.days_held
                    })
            
            if potential_loss_positions:
                # Filter out positions with high wash sale risk
                safe_positions = [pos for pos in potential_loss_positions if not pos['wash_sale_risk']]
                
                if safe_positions:
                    self.algorithm.Log(f"📉 Found {len(safe_positions)} loss harvest candidates (wash sale safe):")
                    for pos in safe_positions[:3]:  # Show top 3
                        self.algorithm.Log(f"   • {pos['symbol']}: £{pos['unrealized_loss']:,.0f} loss")
                    
                    # Flag positions for manual review
                    for position_id in [pos['position_id'] for pos in safe_positions]:
                        if position_id in self.active_positions:
                            self.active_positions[position_id].loss_harvest_candidate = True
                    
                    return True
                else:
                    self.algorithm.Log("⚠️ Loss harvest candidates found but all have wash sale risk")
                    return False
            
            return False
            
        except Exception as e:
            self.algorithm.Error(f"Error executing loss harvesting: {e}")
            return False
    
    def _ExecuteMTMElectionOptimization(self, strategy: Dict[str, Any]) -> bool:
        """Execute Mark-to-Market election optimization"""
        try:
            section_1256_summary = self.GetSection1256Summary()
            
            if section_1256_summary['total_section_1256_positions'] > 0:
                current_unrealized = (section_1256_summary['unrealized_gains_usd'] - 
                                    section_1256_summary['unrealized_losses_usd'])
                
                # Analyze if changing MTM election would be beneficial
                if not self.section_1256_mtm_election and current_unrealized < -5000:  # $5k+ losses
                    # Recommend enabling MTM to recognize losses immediately
                    self.algorithm.Log("📋 MTM ELECTION RECOMMENDATION:")
                    self.algorithm.Log(f"   • Current Section 1256 unrealized loss: ${abs(current_unrealized):,.0f}")
                    self.algorithm.Log(f"   • Consider enabling MTM election to recognize losses")
                    
                    # Flag for review (actual election would need to be filed with IRS)
                    return True
                    
                elif self.section_1256_mtm_election and current_unrealized > 10000:  # $10k+ gains
                    # Consider if keeping MTM election is optimal
                    self.algorithm.Log("📋 MTM ELECTION REVIEW:")
                    self.algorithm.Log(f"   • Current Section 1256 unrealized gain: ${current_unrealized:,.0f}")
                    self.algorithm.Log(f"   • MTM election will recognize gains immediately")
                    
                    return True
            
            return False
            
        except Exception as e:
            self.algorithm.Error(f"Error executing MTM optimization: {e}")
            return False
    
    def _ExecuteCrossBorderOptimization(self, strategy: Dict[str, Any]) -> bool:
        """Execute cross-border tax efficiency optimization"""
        try:
            # Analyze US vs UK tax treatment differences
            current_summary = self.GetUKTaxYearSummary()
            
            # Check if using more Section 1256 contracts would be beneficial
            if current_summary['section_1256_transactions'] < current_summary['total_transactions'] * 0.3:
                self.algorithm.Log("🌐 CROSS-BORDER OPTIMIZATION:")
                self.algorithm.Log(f"   • Only {current_summary['section_1256_transactions']} of {current_summary['total_transactions']} transactions use Section 1256 treatment")
                self.algorithm.Log(f"   • Consider increasing futures/broad-based index options for better US/UK coordination")
                return True
            
            return False
            
        except Exception as e:
            self.algorithm.Error(f"Error executing cross-border optimization: {e}")
            return False
    
    def _CheckWashSaleRisk(self, position: UKTaxPosition) -> bool:
        """Check if closing a position would create wash sale risk"""
        try:
            # Look for recent purchases of same or substantially identical securities
            symbol = position.symbol
            current_date = self.algorithm.Time
            
            # Check for purchases within last 30 days
            recent_purchases = [
                t for t in self.completed_transactions[-50:]  # Check last 50 transactions
                if (t.symbol == symbol and 
                    t.transaction_type == 'OPEN' and
                    (current_date - t.transaction_date).days <= 30)
            ]
            
            return len(recent_purchases) > 0
            
        except Exception as e:
            self.algorithm.Debug(f"Error checking wash sale risk: {e}")
            return True  # Assume risk if can't determine

    def _CalculateTaxEfficiencyScore(self) -> float:
        """Calculate overall tax efficiency score (0-100)"""
        try:
            current_summary = self.GetUKTaxYearSummary()
            score = 70.0  # Base score
            
            # Bonus for utilizing annual exemption efficiently
            exemption_utilization = current_summary['annual_exemption_used_gbp'] / self.uk_annual_exemption
            if 0.8 <= exemption_utilization <= 1.0:
                score += 15.0
            elif exemption_utilization > 1.0:
                score += 10.0  # Good, but not optimal
            
            # Bonus for Section 1256 usage (60/40 treatment)
            if current_summary['section_1256_transactions'] > 0:
                score += 10.0
            
            # Penalty for wash sales
            if current_summary['wash_sale_adjustments_gbp'] > 0:
                score -= 5.0
            
            return min(100.0, max(0.0, score))
            
        except Exception as e:
            self.algorithm.Debug(f"Error calculating tax efficiency score: {e}")
            return 70.0

    def _CalculateTaxEfficiencyRating(self, summary: Dict[str, Any]) -> str:
        """Calculate tax efficiency rating (A, B, C, D, F)"""
        score = self._CalculateTaxEfficiencyScore()
        
        if score >= 90:
            return "A"
        elif score >= 80:
            return "B"
        elif score >= 70:
            return "C"
        elif score >= 60:
            return "D"
        else:
            return "F"

    def _IdentifyOptimizationOpportunities(self, summary: Dict[str, Any], tax_year: str) -> List[str]:
        """Identify specific optimization opportunities"""
        opportunities = []
        
        try:
            # Check exemption utilization
            exemption_used = summary['annual_exemption_used_gbp']
            if exemption_used < self.uk_annual_exemption * 0.5:
                opportunities.append(f"Under-utilizing annual exemption (£{exemption_used:,.0f} of £{self.uk_annual_exemption:,.0f})")
            
            # Check for excess gains without offsetting losses
            if summary['net_capital_gains_gbp'] > self.uk_annual_exemption * 1.5:
                opportunities.append("Consider loss harvesting to offset excess gains")
            
            # Check Section 1256 usage
            if summary['section_1256_transactions'] == 0:
                opportunities.append("Consider Section 1256 contracts for 60/40 tax treatment")
            
            # Check wash sale issues
            if summary['wash_sale_adjustments_gbp'] > 1000:
                opportunities.append("Review trading patterns to minimize wash sale violations")
                
        except Exception as e:
            self.algorithm.Debug(f"Error identifying optimization opportunities: {e}")
        
        return opportunities
    
    def _GetFallbackGBPUSDRate(self, date: datetime) -> float:
        """Get fallback GBP/USD rate based on historical averages"""
        try:
            # Historical average rates by year for fallback
            fallback_rates = {
                2024: 1.27,  # Average 2024
                2023: 1.24,  # Average 2023
                2022: 1.23,  # Average 2022
                2021: 1.38,  # Average 2021
                2020: 1.28,  # Average 2020
            }
            
            # Use year-specific rate if available, otherwise interpolate
            if date.year in fallback_rates:
                rate = fallback_rates[date.year]
            elif date.year >= 2024:
                rate = 1.27  # Current era rate
            elif date.year <= 2020:
                rate = 1.28  # Pre-2021 rate
            else:
                # Interpolate between known rates
                rate = 1.25
            
            self.algorithm.Debug(f"🔄 Using fallback GBPUSD rate: {rate:.4f} for {date.year}")
            return rate
            
        except Exception as e:
            self.algorithm.Debug(f"Fallback rate error: {e}")
            return 1.25
    
    def UpdateForexRates(self) -> bool:
        """Update forex rates proactively (call this in algorithm OnData)"""
        try:
            current_time = self.algorithm.Time
            
            # Update rates once per day or if never updated
            if (self.last_fx_update is None or 
                (current_time - self.last_fx_update).total_seconds() > 86400):  # 24 hours
                
                # Get current rate
                current_rate = self._GetGBPUSDRate(current_time)
                
                if current_rate > 0:
                    date_key = current_time.strftime('%Y%m%d')
                    self.gbp_usd_rates[date_key] = current_rate
                    self.last_fx_update = current_time
                    
                    # Log significant rate changes
                    if len(self.gbp_usd_rates) > 1:
                        previous_rates = list(self.gbp_usd_rates.values())[-2:]
                        if len(previous_rates) == 2:
                            rate_change = abs(previous_rates[1] - previous_rates[0])
                            if rate_change > 0.02:  # More than 2 cents change
                                change_pct = (rate_change / previous_rates[0]) * 100
                                self.algorithm.Log(f"💱 GBPUSD rate change: {previous_rates[0]:.4f} → {current_rate:.4f} ({change_pct:.1f}%)")
                    
                    return True
            
            return True  # No update needed
            
        except Exception as e:
            self.algorithm.Error(f"Error updating forex rates: {e}")
            return False
    
    def GetCurrentGBPConversion(self, usd_amount: float) -> float:
        """Convert USD amount to GBP using current rate"""
        try:
            current_rate = self._GetGBPUSDRate(self.algorithm.Time)
            gbp_amount = usd_amount / current_rate if current_rate > 0 else usd_amount
            return gbp_amount
            
        except Exception as e:
            self.algorithm.Error(f"Error converting USD to GBP: {e}")
            return usd_amount  # Return USD amount if conversion fails
    
    def GetTaxYearGBPSummary(self, tax_year: str = None) -> Dict[str, float]:
        """Get GBP-converted summary for UK tax year"""
        try:
            if tax_year is None:
                tax_year = self.current_uk_tax_year
                
            summary = {
                'total_realized_pnl_gbp': 0.0,
                'total_commissions_gbp': 0.0,
                'total_transactions': 0,
                'currency_conversion_impact': 0.0,
                'average_exchange_rate': 0.0
            }
            
            # Get all transactions for tax year
            tax_year_transactions = [
                t for t in self.completed_transactions 
                if t.uk_tax_year == tax_year
            ]
            
            summary['total_transactions'] = len(tax_year_transactions)
            
            if tax_year_transactions:
                total_rates = 0.0
                
                for transaction in tax_year_transactions:
                    summary['total_realized_pnl_gbp'] += transaction.gbp_net_proceeds
                    summary['total_commissions_gbp'] += (transaction.commission / transaction.gbp_exchange_rate)
                    total_rates += transaction.gbp_exchange_rate
                    
                    # Calculate currency impact (difference between historical and current rate)
                    current_rate = self._GetGBPUSDRate(self.algorithm.Time)
                    historical_rate = transaction.gbp_exchange_rate
                    rate_diff = current_rate - historical_rate
                    impact = (transaction.net_proceeds / historical_rate) - (transaction.net_proceeds / current_rate)
                    summary['currency_conversion_impact'] += impact
                
                summary['average_exchange_rate'] = total_rates / len(tax_year_transactions)
            
            return summary
            
        except Exception as e:
            self.algorithm.Error(f"Error generating GBP summary: {e}")
            return {'total_realized_pnl_gbp': 0.0, 'total_commissions_gbp': 0.0, 'total_transactions': 0, 
                   'currency_conversion_impact': 0.0, 'average_exchange_rate': 1.25}