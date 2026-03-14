// Custom lightweight test runner to bypass Jest installation issues
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting Lightweight Test Runner...\n');

// Global state for tests
let currentDescribe = '';
let passed = 0;
let failed = 0;

// -- Mock Jest Globals --

global.describe = (name, fn) => {
    currentDescribe = name;
    console.log(`\n📦 ${name}`);
    try {
        fn();
    } catch (e) {
        console.error(`  ❌ Describe block failed: ${e.message}`);
    }
};

global.test = async (name, fn) => {
    try {
        await fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (e) {
        console.error(`  ❌ ${name}`);
        console.error(`     Error: ${e.message}`); // Simplified error
        failed++;
    }
};

global.beforeAll = (fn) => {
    try {
        fn();
    } catch (e) {
        console.error(`  ❌ beforeAll failed: ${e.message}`);
    }
};

// -- Mock Expect Matchers --

global.expect = (actual) => {
    return {
        toBe: (expected) => {
            if (actual !== expected) {
                throw new Error(`Expected ${expected} but got ${actual}`);
            }
        },
        toBeNull: () => {
            if (actual !== null) {
                throw new Error(`Expected null but got ${actual}`);
            }
        },
        toEqual: (expected) => {
            // Simple JSON comparison for objects
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
            }
        }
    };
};

// -- Run the specific test file --

// Change this line to run different tests
// const testFile = './tests/riskCalculator.test.standalone.js';
// const testFile = './tests/auth.test.standalone.js'; 
// const testFile = './tests/roleMiddleware.test.standalone.js'; 
const testFile = './tests/reportMetrics.test.standalone.js';

try {
    console.log(`Running: ${testFile}`);
    require(path.resolve(testFile));

    // Summary
    setTimeout(() => {
        console.log('\n-------------------');
        console.log(`Tests Completed.`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        console.log(failed === 0 ? '✅ SUITE PASSED' : '❌ SUITE FAILED');
        console.log('-------------------');
    }, 100);

} catch (e) {
    console.error('Failed to load test file:', e);
}
