#!/bin/bash
# Implementation Audit Tools for Tom King Trading Framework
# Based on IMPLEMENTATION_AUDIT_PROTOCOL.md

# Color output for better visibility
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== TOM KING TRADING FRAMEWORK AUDIT TOOLS ===${NC}"

# Function: Pre-Change Audit
audit_implementation() {
    local concept="$1"
    
    if [ -z "$concept" ]; then
        echo -e "${RED}Usage: audit_implementation <concept>${NC}"
        echo "Example: audit_implementation kelly"
        return 1
    fi
    
    echo -e "${YELLOW}=== IMPLEMENTATION AUDIT FOR: $concept ===${NC}"
    
    # Change to framework directory
    cd "$(dirname "$0")/../../TomKingTradingFramework" || {
        echo -e "${RED}Error: Cannot access TomKingTradingFramework directory${NC}"
        return 1
    }
    
    echo -e "${BLUE}1. Searching for existing implementations...${NC}"
    grep -r "$concept" --include="*.py" -n . | head -20
    
    echo -e "${BLUE}2. Finding related classes/functions...${NC}"
    grep -r "class.*$concept\|def.*$concept" --include="*.py" -n . | head -10
    
    echo -e "${BLUE}3. Checking for imports...${NC}"
    grep -r "import.*$concept\|from.*$concept" --include="*.py" -n . | head -10
    
    echo -e "${BLUE}4. Looking for similar patterns...${NC}"
    grep -r "calculate.*$concept\|get.*$concept\|manage.*$concept" --include="*.py" -n . | head -10
    
    echo -e "${YELLOW}=== REVIEW ABOVE BEFORE IMPLEMENTING ===${NC}"
}

# Function: Post-Change Validation
validate_redundancy() {
    local function_name="$1"
    local pattern="$2"
    
    if [ -z "$function_name" ]; then
        echo -e "${RED}Usage: validate_redundancy <function_name> [pattern]${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}=== REDUNDANCY CHECK FOR: $function_name ===${NC}"
    
    cd "$(dirname "$0")/../../TomKingTradingFramework" || return 1
    
    echo -e "${BLUE}1. Finding duplicate function names...${NC}"
    find . -name "*.py" -exec grep -l "def $function_name" {} \; | while read file; do
        echo -e "${GREEN}Found in: $file${NC}"
        grep -n "def $function_name" "$file"
    done
    
    if [ -n "$pattern" ]; then
        echo -e "${BLUE}2. Checking for duplicate logic patterns...${NC}"
        grep -r "$pattern" --include="*.py" -A 5 -B 5 .
    fi
    
    echo -e "${YELLOW}=== VALIDATE NO UNINTENDED DUPLICATION ===${NC}"
}

# Function: System Architecture Map
map_system() {
    echo -e "${YELLOW}=== SYSTEM ARCHITECTURE MAP ===${NC}"
    
    cd "$(dirname "$0")/../../TomKingTradingFramework" || return 1
    
    echo -e "${BLUE}CORE SYSTEMS:${NC}"
    find . -path "./core/*.py" -o -path "./risk/*.py" -o -path "./helpers/*.py" | sort | while read file; do
        echo "├── $file"
        # Show main classes/functions
        grep -n "^class\|^def " "$file" 2>/dev/null | head -3 | sed 's/^/│   /'
    done
    
    echo -e "${BLUE}STRATEGY IMPLEMENTATIONS:${NC}"
    find . -path "./strategies/*.py" | sort | while read file; do
        echo "├── $file"
        grep -n "^class.*Strategy" "$file" 2>/dev/null | head -1 | sed 's/^/│   /'
    done
}

# Function: Interface Compatibility Check
check_interfaces() {
    echo -e "${YELLOW}=== INTERFACE COMPATIBILITY CHECK ===${NC}"
    
    cd "$(dirname "$0")/../../TomKingTradingFramework" || return 1
    
    # Check main.py expectations vs implementations
    if [ -f "main.py" ]; then
        echo -e "${BLUE}Checking main.py interface expectations...${NC}"
        
        # Extract method calls from main.py
        grep -n "\\.\\w\\+(" main.py | head -20 | while read line; do
            echo "main.py expects: $line"
        done
        
        echo -e "${BLUE}Verifying implementations exist...${NC}"
        # This would need more sophisticated parsing for full verification
    fi
}

# Function: Quick Health Check
health_check() {
    echo -e "${YELLOW}=== FRAMEWORK HEALTH CHECK ===${NC}"
    
    cd "$(dirname "$0")/../../TomKingTradingFramework" || return 1
    
    echo -e "${BLUE}1. Checking for common redundancy patterns...${NC}"
    
    # Check for multiple Kelly implementations
    kelly_count=$(grep -r "kelly.*formula\|win_rate.*avg_win" --include="*.py" . | wc -l)
    if [ "$kelly_count" -gt 5 ]; then
        echo -e "${RED}WARNING: Possible Kelly Criterion redundancy ($kelly_count instances)${NC}"
    else
        echo -e "${GREEN}Kelly Criterion: OK ($kelly_count instances)${NC}"
    fi
    
    # Check for VIX hardcoding
    hardcode_count=$(grep -r "= 20\.0\|= 25\.0" --include="*.py" . | grep -i vix | wc -l)
    if [ "$hardcode_count" -gt 0 ]; then
        echo -e "${RED}WARNING: Possible VIX hardcoding ($hardcode_count instances)${NC}"
    else
        echo -e "${GREEN}VIX Management: OK (no hardcoding detected)${NC}"
    fi
    
    echo -e "${BLUE}2. Checking import consistency...${NC}"
    # Look for unusual import patterns that might indicate redundancy
    find . -name "*.py" -exec grep -H "^from.*import" {} \; | sort | uniq -c | sort -nr | head -10
}

# Main menu
case "${1:-menu}" in
    "audit")
        audit_implementation "$2"
        ;;
    "validate")
        validate_redundancy "$2" "$3"
        ;;
    "map")
        map_system
        ;;
    "interfaces")
        check_interfaces
        ;;
    "health")
        health_check
        ;;
    "menu"|*)
        echo -e "${GREEN}Tom King Trading Framework Audit Tools${NC}"
        echo ""
        echo "Usage: $0 <command> [args...]"
        echo ""
        echo "Commands:"
        echo "  audit <concept>          - Audit existing implementations before changes"
        echo "  validate <function>      - Check for redundant implementations"
        echo "  map                      - Show system architecture"
        echo "  interfaces              - Check interface compatibility"
        echo "  health                  - Quick framework health check"
        echo ""
        echo "Examples:"
        echo "  $0 audit kelly"
        echo "  $0 validate calculate_position_size"
        echo "  $0 health"
        ;;
esac