const DELAY_MIN_MS = 5000;
const DELAY_MAX_MS = 10000;

// Counter for deterministic retry testing
let retryAttempt = 0;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function submitForm(data) {
  // TEST CASE 1: Force Persistent Failure (Simulates Server Down)
  if (data.email === 'error@example.com') {
    console.log('[MockAPI] Forcing 503 error (Always Fail)');
    return Promise.reject({
      status: 503,
      message: 'Service Temporarily Unavailable (Forced)',
    });
  }

  // TEST CASE 2: Force Retry -> Success (Simulates Glitch)
  if (data.email === 'retry@example.com') {
    retryAttempt++;
    console.log(`[MockAPI] Retry Test: Attempt ${retryAttempt}`);

    // Fail the first 2 times, succeed on the 3rd
    if (retryAttempt < 3) {
      return Promise.reject({
        status: 503,
        message: 'Service is hiccups... (Will recover)'
      });
    }
    // Reset for next manual test
    retryAttempt = 0;
    return Promise.resolve({
      success: true,
      data: { ...data, id: `mock-recovered-${Date.now()}` },
    });
  }

  const outcome = randomInt(0, 2);

  if (outcome === 0) {
    return Promise.resolve({
      success: true,
      data: { ...data, id: `mock-${Date.now()}-${randomInt(1000, 9999)}` },
    });
  }

  if (outcome === 1) {
    const delayMs = randomInt(DELAY_MIN_MS, DELAY_MAX_MS);
    return delay(delayMs).then(() => ({
      success: true,
      data: { ...data, id: `mock-${Date.now()}-${randomInt(1000, 9999)}` },
    }));
  }

  return Promise.reject({
    status: 503,
    message: 'Service temporarily unavailable',
  });
}
