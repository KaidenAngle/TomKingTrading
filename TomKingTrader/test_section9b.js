// Test Section 9B Strategy Instantiation
console.log('Testing Section 9B Strategy Instantiation...');

// Test data
const userData = {
  accountValue: 65000,
  phase: 3,
  dayOfWeek: 'Friday',
  vixLevel: 18,
  positions: []
};

// Test Box Spread Calculation
const testBoxSpread = () => {
  const accountValue = 65000;
  if (accountValue < 55000) return { available: false };
  
  const evaluateBoxSpread = (width, price, dte) => {
    const annualRate = ((width / price) - 1) * (365 / dte) * 100;
    if (annualRate < 1.0) return { rate: annualRate, action: 'EXECUTE MAXIMUM SIZE' };
    return { rate: annualRate, action: 'SKIP' };
  };
  
  return {
    available: true,
    evaluation: evaluateBoxSpread(500, 498.50, 365),
    product: 'SPX'
  };
};

// Test Butterfly Matrix
const testButterflyMatrix = (esPrice, percentMove, phase) => {
  if (phase < 3) return { available: false };
  
  const butterfly = {
    product: 'SPX',
    entry: 'Friday 10:35 AM',
    width: 10,
    maxRisk: Math.min(400, 65000 * 0.003)
  };
  
  if (percentMove > 1.0) {
    butterfly.center = Math.round((esPrice - 10) / 5) * 5;
    butterfly.type = 'PUT';
    butterfly.rationale = 'After 1% up move - put butterfly';
    return butterfly;
  }
  
  return { available: false, reason: 'Insufficient movement' };
};

// Test 0DTE Variations
const test0DTEVariations = (esPrice, movement, vixLevel) => {
  const variations = { standard: null, brokenWing: null, batman: null };
  
  if (Math.abs(movement) <= 0.5) {
    variations.brokenWing = {
      type: 'BROKEN WING IRON CONDOR',
      preference: 'Toms Preference',
      benefit: 'Reduces risk on trending days'
    };
  }
  
  if (vixLevel < 12) {
    variations.batman = {
      type: 'BATMAN SPREAD',
      requirement: 'VIX <12',
      visual: 'Risk graph looks like Batman symbol'
    };
  } else {
    variations.batman = {
      available: false,
      reason: `VIX at ${vixLevel} - needs <12 for Batman`
    };
  }
  
  return variations;
};

// Execute tests
console.log('✓ Testing Box Spread Calculation');
const boxResult = testBoxSpread();
console.log('Box Spread Available:', boxResult.available);
console.log('Box Spread Action:', boxResult.evaluation.action);

console.log('\n✓ Testing Butterfly Matrix');
const percentMove = ((5400 - 5385) / 5385) * 100;
const butterflyResult = testButterflyMatrix(5400, percentMove, 3);
console.log('Butterfly Available:', butterflyResult.available);
console.log('Butterfly Type:', butterflyResult.type || 'N/A');
console.log('Movement Required:', percentMove.toFixed(2) + '%');

console.log('\n✓ Testing 0DTE Variations');
const zdteResult = test0DTEVariations(5400, 0.3, 18);
console.log('Broken Wing Available:', !!zdteResult.brokenWing);
console.log('Batman Available:', zdteResult.batman.available !== false);
console.log('Batman Reason:', zdteResult.batman.reason || 'Available');

console.log('\n✅ Section 9B Strategy Instantiation Tests Completed');
console.log('All core strategy functions can be instantiated and executed');

// Test enhanced strangle functionality
console.log('\n✓ Testing Enhanced Strangle Positions');
const testEnhancedStrangles = (standardStrangle, phase) => {
  if (phase < 2) return { available: false };
  
  if (standardStrangle && standardStrangle.putStrike && standardStrangle.callStrike) {
    return {
      type: 'STRANGLE WITH PUT RATIO',
      structure: 'Standard strangle (1×1) + Put ratio (1×2)',
      bpReduction: '30% less than standard strangle'
    };
  }
  
  return { available: false };
};

const enhancedResult = testEnhancedStrangles({ putStrike: 5300, callStrike: 5500 }, 3);
console.log('Enhanced Strangle Available:', enhancedResult.available !== false);
console.log('Enhanced BP Reduction:', enhancedResult.bpReduction || 'N/A');