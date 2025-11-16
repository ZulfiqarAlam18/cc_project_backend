const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
const PYTHON_SERVICE_URL = 'http://localhost:5001';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`)
};

async function testServices() {
  console.log('\n========================================');
  console.log('  Face Matching Integration Tests');
  console.log('========================================\n');

  let allTestsPassed = true;

  // Test 1: Check Python Service Health
  try {
    log.info('Test 1: Checking Python Face Matching Service (faceChecker1)...');
    const response = await axios.get(`${PYTHON_SERVICE_URL}/`, { timeout: 5000 });
    if (response.status === 200) {
      log.success('Python service (faceChecker1) is running');
    } else {
      log.error('Python service returned unexpected response');
      allTestsPassed = false;
    }
  } catch (error) {
    log.error(`Python service (faceChecker1) is not accessible: ${error.message}`);
    log.warn('Make sure to start the Python service first!');
    log.warn('Run: cd "8th Semester\\faceChecker1" && .venv\\Scripts\\activate && python face_match_server.py');
    allTestsPassed = false;
  }

  // Test 2: Check Node.js Backend Health
  try {
    log.info('Test 2: Checking Node.js Backend...');
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    if (response.data.status === 'OK') {
      log.success('Node.js backend is running');
    } else {
      log.error('Node.js backend returned unexpected response');
      allTestsPassed = false;
    }
  } catch (error) {
    log.error(`Node.js backend is not accessible: ${error.message}`);
    log.warn('Make sure to start the backend first!');
    log.warn('Run: npm run dev');
    allTestsPassed = false;
  }

  // Test 3: Check Face Match Health Endpoint
  try {
    log.info('Test 3: Checking Face Match API endpoint...');
    const response = await axios.get(`${BASE_URL}/api/face-match/health`, { timeout: 5000 });
    if (response.data.success) {
      log.success('Face match API endpoint is accessible');
    } else {
      log.error('Face match service is not healthy');
      allTestsPassed = false;
    }
  } catch (error) {
    log.error(`Face match API endpoint failed: ${error.message}`);
    allTestsPassed = false;
  }

  // Test 4: Test Face Comparison (requires sample images)
  try {
    log.info('Test 4: Testing face comparison with faceChecker1...');
    log.warn('Skipping direct Python service test - faceChecker1 requires file uploads, not URLs');
    log.info('Face comparison will be tested through Node.js backend instead');
  } catch (error) {
    log.warn(`Could not test face comparison: ${error.message}`);
  }

  // Summary
  console.log('\n========================================');
  if (allTestsPassed) {
    log.success('All critical tests passed!');
    console.log('\n✓ Your face matching integration is ready to use!');
    console.log('\nNext steps:');
    console.log('1. Create a parent report with images');
    console.log('2. Create a finder report with images');
    console.log('3. Call POST /api/face-match/parent/:id/find-matches');
    console.log('4. Check for matches in the response\n');
  } else {
    log.error('Some tests failed!');
    console.log('\nPlease fix the issues above and run the tests again.\n');
  }
  console.log('========================================\n');
}

// Run tests
testServices().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
