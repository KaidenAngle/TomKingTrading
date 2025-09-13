# Script to systematically fix all bare except clauses in the framework
# Replaces dangerous bare except: with appropriate specific exceptions

import os
import re

def fix_bare_except_clauses():
    """Fix all bare except clauses with appropriate specific exceptions"""
    
    fixes = [
        # Greeks monitor - risk calculation
        {
            'file': 'greeks/greeks_monitor.py',
            'line': 889,
            'old': '        except:',
            'new': '        except (KeyError, AttributeError, ZeroDivisionError) as e:',
            'comment': '            # Handle missing risk data, attributes, or division by zero in risk calculations'
        },
        
        # Order helpers - emergency cleanup
        {
            'file': 'helpers/simple_order_helpers.py', 
            'line': 90,
            'old': '                except:',
            'new': '                except (RuntimeError, AttributeError) as e:',
            'comment': '                    # Handle order cancellation/execution errors during emergency cleanup'
        },
        
        # Trading dashboard - price lookup
        {
            'file': 'reporting/trading_dashboard.py',
            'line': 290,
            'old': '        except:',
            'new': '        except (KeyError, AttributeError, ValueError) as e:',
            'comment': '            # Handle missing security data or invalid price conversion'
        },
        
        # Order validation - order cancellation
        {
            'file': 'risk/order_validation.py',
            'line': 338,
            'old': '            except:',
            'new': '            except (RuntimeError, InvalidOperationException) as e:',
            'comment': '                # Order may already be filled/cancelled or invalid operation'
        },
        
        # Production logging - connection check
        {
            'file': 'risk/production_logging.py',
            'line': 290,
            'old': '        except:',
            'new': '        except (AttributeError, ConnectionError, TimeoutError) as e:',
            'comment': '            # Handle missing brokerage attributes or connection issues'
        },
        
        # Friday strategy - cache invalidation
        {
            'file': 'strategies/friday_0dte_with_state.py',
            'line': 383,
            'old': '        except:',
            'new': '        except (AttributeError, RuntimeError) as e:',
            'comment': '            # Don\'t fail order placement due to cache issues'
        },
        
        # IPMCC strategy - SMA calculation errors (first instance)
        {
            'file': 'strategies/ipmcc_with_state.py',
            'line': 607,
            'old': '                    except:',
            'new': '                    except (AttributeError, RuntimeError) as e:',
            'comment': '                        # Ignore SMA calculation errors'
        },
        
        # IPMCC strategy - SMA calculation errors (second instance)  
        {
            'file': 'strategies/ipmcc_with_state.py',
            'line': 661,
            'old': '                    except:',
            'new': '                    except (AttributeError, RuntimeError) as e:',
            'comment': '                        # Ignore SMA calculation errors'
        },
        
        # System validator - VIX regime lookup
        {
            'file': 'validation/system_validator.py',
            'line': 191,
            'old': '            except:',
            'new': '            except (AttributeError, KeyError) as e:',
            'comment': '                # Handle missing VIX manager or invalid regime data'
        }
    ]
    
    framework_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    fixed_count = 0
    
    for fix in fixes:
        file_path = os.path.join(framework_root, fix['file'])
        
        try:
            # Apply fix for bare except clauses
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Replace the old bare except with specific exception handling
            if fix['old'] in content:
                new_content = content.replace(
                    fix['old'],
                    fix['new'] + '\n' + fix['comment']
                )
                
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                
                fixed_count += 1
                print(f"✓ Fixed {fix['file']}:{fix['line']}")
            else:
                print(f"⚠ Could not find pattern in {fix['file']}:{fix['line']}")
                
        except Exception as e:
            print(f"✗ Error fixing {fix['file']}: {e}")
    
    print(f"\nFixed {fixed_count}/{len(fixes)} bare except clauses")
    return fixed_count

if __name__ == '__main__':
    print("=== FIXING BARE EXCEPT CLAUSES ===")
    print("Replacing dangerous bare except: patterns with specific exception handling...")
    print()
    
    fixed_count = fix_bare_except_clauses()
    
    print()
    if fixed_count > 0:
        print(f"✅ Successfully fixed {fixed_count} bare except clauses!")
        print("Framework now has proper exception handling.")
    else:
        print("❌ No fixes applied - manual intervention may be needed.")