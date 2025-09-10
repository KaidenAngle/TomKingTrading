#!/usr/bin/env python3
"""
Position Synchronization Bridge
Critical system to sync between main.py active_positions and PositionStateManager
Prevents the catastrophic dual-tracking issue
"""

from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Dict, List, Optional

class PositionSyncBridge:
    """
    CRITICAL: Synchronizes main algorithm active_positions with PositionStateManager
    Prevents dual tracking systems from getting out of sync
    """
    
    def __init__(self, algorithm, position_state_manager):
        self.algo = algorithm
        self.psm = position_state_manager
        
    def sync_new_position_to_active_list(self, position_id: str, strategy: str, symbol: str, 
                                        entry_data: Dict = None) -> bool:
        """
        CRITICAL: When PositionStateManager creates a new position, 
        also add it to main algorithm's active_positions list
        """
        try:
            position = self.psm.positions.get(position_id)
            if not position:
                return False
                
            # Convert PSM position to active_positions format
            active_position_entry = {
                'id': position_id,
                'strategy': strategy,
                'symbol': symbol,
                'entry_time': position.entry_time,
                'status': 'open',
                'psm_managed': True,  # Flag to indicate this is managed by PSM
                'components': list(position.components.keys())  # Track component IDs
            }
            
            # Add strategy-specific data
            if entry_data:
                active_position_entry.update(entry_data)
                
            # Add to main algorithm's tracking
            self.algo.active_positions.append(active_position_entry)
            self.algo.Log(f"[WARNING] Synced PSM position {position_id} to active_positions")
            
            return True
            
        except Exception as e:
            self.algo.Error(f"Error syncing position to active list: {str(e)}")
            return False
            
    def sync_position_close_to_active_list(self, position_id: str) -> bool:
        """
        CRITICAL: When PSM closes a position, update active_positions status
        """
        try:
            # Find and update the position in active_positions
            for active_pos in self.algo.active_positions:
                if active_pos.get('id') == position_id:
                    active_pos['status'] = 'closed'
                    active_pos['close_time'] = datetime.now()
                    self.algo.Log(f"[WARNING] Marked position {position_id} as closed in active_positions")
                    return True
                    
            return False
            
        except Exception as e:
            self.algo.Error(f"Error syncing position close: {str(e)}")
            return False
            
    def sync_component_close_to_active_list(self, position_id: str, component_id: str) -> bool:
        """
        CRITICAL: When PSM closes individual components, track in active_positions
        """
        try:
            # Find the position in active_positions
            for active_pos in self.algo.active_positions:
                if active_pos.get('id') == position_id:
                    if 'closed_components' not in active_pos:
                        active_pos['closed_components'] = []
                    active_pos['closed_components'].append({
                        'component_id': component_id,
                        'close_time': datetime.now()
                    })
                    
                    # Check if position is partially closed
                    psm_position = self.psm.positions.get(position_id)
                    if psm_position and psm_position.status == "PARTIALLY_CLOSED":
                        active_pos['status'] = 'partially_closed'
                        
                    self.algo.Log(f"[WARNING] Synced component {component_id} close to active_positions")
                    return True
                    
            return False
            
        except Exception as e:
            self.algo.Error(f"Error syncing component close: {str(e)}")
            return False
            
    def get_synchronized_positions_for_analysis(self, strategy_filter: str = None) -> List[Dict]:
        """
        CRITICAL: Return positions in format expected by analysis functions
        Combines PSM data with active_positions tracking
        """
        try:
            synchronized_positions = []
            
            for active_pos in self.algo.active_positions:
                if strategy_filter and active_pos.get('strategy') != strategy_filter:
                    continue
                    
                if active_pos.get('status') != 'open':
                    continue
                    
                # If this is a PSM-managed position, enhance with PSM data
                if active_pos.get('psm_managed'):
                    position_id = active_pos['id']
                    psm_position = self.psm.positions.get(position_id)
                    
                    if psm_position:
                        # Create enhanced position data for analysis
                        enhanced_position = active_pos.copy()
                        enhanced_position.update({
                            'psm_position': psm_position,
                            'total_pnl': psm_position.calculate_total_pnl(),
                            'component_count': len(psm_position.components),
                            'components_data': {
                                comp_id: {
                                    'leg_type': comp.leg_type,
                                    'strike': comp.strike,
                                    'expiry': comp.expiry,
                                    'pnl': comp.pnl,
                                    'status': comp.status
                                } for comp_id, comp in psm_position.components.items()
                            }
                        })
                        synchronized_positions.append(enhanced_position)
                    else:
                        # PSM position not found, add warning
                        self.algo.Log(f"[WARNING] PSM position {position_id} not found for sync")
                        synchronized_positions.append(active_pos)
                else:
                    # Non-PSM position, use as-is
                    synchronized_positions.append(active_pos)
                    
            return synchronized_positions
            
        except Exception as e:
            self.algo.Error(f"Error getting synchronized positions: {str(e)}")
            return self.algo.active_positions  # Fallback to original tracking
            
    def clean_closed_positions(self) -> int:
        """Clean up closed positions from active_positions list"""
        try:
            original_count = len(self.algo.active_positions)
            self.algo.active_positions = [p for p in self.algo.active_positions 
                                        if p.get('status') != 'closed']
            cleaned_count = original_count - len(self.algo.active_positions)
            
            if cleaned_count > 0:
                self.algo.Log(f"[WARNING] Cleaned {cleaned_count} closed positions from tracking")
                
            return cleaned_count
            
        except Exception as e:
            self.algo.Error(f"Error cleaning positions: {str(e)}")
            return 0
            
    def validate_sync_integrity(self) -> Dict:
        """
        Validate that PSM and active_positions are properly synchronized
        """
        try:
            psm_positions = len(self.psm.positions)
            active_psm_positions = len([p for p in self.algo.active_positions 
                                      if p.get('psm_managed')])
            active_total = len([p for p in self.algo.active_positions 
                              if p.get('status') == 'open'])
            
            integrity_report = {
                'psm_positions': psm_positions,
                'active_psm_positions': active_psm_positions,
                'active_total': active_total,
                'sync_ratio': active_psm_positions / max(psm_positions, 1),
                'is_synchronized': active_psm_positions == psm_positions
            }
            
            if not integrity_report['is_synchronized']:
                self.algo.Log(f"[WARNING] SYNC WARNING: PSM has {psm_positions} positions, "
                            f"active_positions has {active_psm_positions} PSM positions")
                
            return integrity_report
            
        except Exception as e:
            self.algo.Error(f"Error validating sync integrity: {str(e)}")
            return {'error': str(e)}