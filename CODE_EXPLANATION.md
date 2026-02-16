# Complete Line-by-Line Code Explanation

This document explains every single line of code in the Eventually Consistent Form project, excluding external npm packages.

---

## Table of Contents
1. [Mock API (`src/mockApi/api.js`)](#1-mock-api-srcmockapiapijs)
2. [Form Submission Hook (`src/hooks/useFormSubmission.js`)](#2-form-submission-hook-srchooksuseformsubmissionjs)
3. [Transaction Form Component (`src/components/TransactionForm.js`)](#3-transaction-form-component-srccomponentstransactionformjs)
4. [Component Styles (`src/components/TransactionForm.module.css`)](#4-component-styles-srccomponentstransactionformmodulecss)
5. [Root App Component (`src/App.js`)](#5-root-app-component-srcappjs)
6. [App Styles (`src/App.css`)](#6-app-styles-srcappcss)

---

## 1. Mock API (`src/mockApi/api.js`)

This file simulates a backend server API that responds unpredictably to showcase eventual consistency handling.

### Line 1-2: Configuration Constants
```javascript
const DELAY_MIN_MS = 5000;
const DELAY_MAX_MS = 10000;
```
**Purpose**: Define the time range for delayed responses.
- `DELAY_MIN_MS`: Minimum delay (5 seconds)
- `DELAY_MAX_MS`: Maximum delay (10 seconds)
**Why**: The requirements state the API should respond with "delayed success (responds after 5–10 seconds)". These constants ensure we meet that exact specification.

### Line 4-5: Retry Test Counter
```javascript
// Counter for deterministic retry testing
let retryAttempt = 0;
```
**Purpose**: Track retry attempts for the `retry@example.com` test case.
**Why**: We need a stateful counter outside the function scope to remember how many times the API has been called for the same email. This allows us to create a deterministic test scenario.
**How it works**: Each call increments this, allowing us to fail on attempts 1 and 2, then succeed on attempt 3.

### Line 7-9: Random Integer Generator
```javascript
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
```
**Purpose**: Generate a random integer between `min` and `max` (inclusive).
**Why**: JavaScript's `Math.random()` gives a decimal (0 to 1). We need whole numbers.
**How it works**:
- `Math.random()` → random decimal like 0.742
- `* (max - min + 1)` → scales it to the range
- `+ min` → shifts it to start from `min`
- `Math.floor(...)` → rounds down to get an integer

**Example**: `randomInt(0, 2)` can return 0, 1, or 2.

### Line 11-13: Async Delay Helper
```javascript
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```
**Purpose**: Create an artificial delay (simulate network latency).
**Why**: The delayed success scenario requires waiting before responding.
**How it works**:
- Returns a Promise (allows `await` usage)
- `setTimeout` waits `ms` milliseconds
- When time expires, `resolve()` is called, fulfilling the Promise

**Usage**: `await delay(5000)` pauses execution for 5 seconds.

### Line 15: Main API Function
```javascript
export function submitForm(data) {
```
**Purpose**: The main function that simulates the backend API endpoint.
**Why**: This is what the frontend calls to "submit" the form. It's exported so other files can import and use it.
**Input**: `data` - Object containing `{ email, amount, idempotencyKey }`

### Line 16-23: Test Case 1 - Forced Persistent Failure
```javascript
  // TEST CASE 1: Force Persistent Failure (Simulates Server Down)
  if (data.email === 'error@example.com') {
    console.log('[MockAPI] Forcing 503 error (Always Fail)');
    return Promise.reject({
      status: 503,
      message: 'Service Temporarily Unavailable (Forced)',
    });
  }
```
**Purpose**: Deterministic test path for error handling.
**Why**: During testing, we need a reliable way to trigger errors.
**How it works**:
- Checks if the email exactly matches `'error@example.com'`
- If yes, immediately returns a rejected Promise with HTTP 503 status
- `Promise.reject` means "this failed"
- The custom hook will see this 503 and attempt retries

**User Experience**: When you use this email, you'll see:
1. "Processing..."
2. "Retrying... (Try 1)"
3. "Retrying... (Try 2)"
4. "Retrying... (Try 3)"
5. Final error message

### Line 25-43: Test Case 2 - Forced Retry Recovery
```javascript
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
```
**Purpose**: Simulate a temporary glitch that resolves after retries.
**Why**: The requirements say "If the API fails temporarily, retry automatically". We need to prove this works.
**How it works**:
- Line 27: Increment the global counter
- Line 31: If we haven't hit 3 attempts yet, reject (fail) with 503
- Line 37: Reset counter to 0 (for next test)
- Line 39: Return success with a mock transaction ID

**Flow**:
1. First call: `retryAttempt` becomes 1 → `< 3` → Fail
2. Second call (retry 1): `retryAttempt` becomes 2 → `< 3` → Fail
3. Third call (retry 2): `retryAttempt` becomes 3 → NOT `< 3` → Success!

### Line 45: Random Outcome Selection
```javascript
  const outcome = randomInt(0, 2);
```
**Purpose**: Pick one of three scenarios randomly.
**Why**: Requirements state the API should "respond randomly with: success, temporary failure, delayed success".
**Possible values**:
- `0` → Immediate success
- `1` → Delayed success
- `2` → Temporary failure (503)

### Line 47-52: Outcome 0 - Immediate Success
```javascript
  if (outcome === 0) {
    return Promise.resolve({
      success: true,
      data: { ...data, id: `mock-${Date.now()}-${randomInt(1000, 9999)}` },
    });
  }
```
**Purpose**: Simulate a normal, fast API response.
**Why**: Happy path - 33% of requests should succeed immediately.
**How it works**:
- `Promise.resolve` → Success
- Spread operator `...data` copies all input fields (email, amount, idempotencyKey)
- Generates a unique ID using current timestamp + random 4-digit number
- Example ID: `mock-1708095234567-4821`

**User sees**: "Processing..." → "Transaction Successful!" (very quick)

### Line 54-60: Outcome 1 - Delayed Success
```javascript
  if (outcome === 1) {
    const delayMs = randomInt(DELAY_MIN_MS, DELAY_MAX_MS);
    return delay(delayMs).then(() => ({
      success: true,
      data: { ...data, id: `mock-${Date.now()}-${randomInt(1000, 9999)}` },
    }));
  }
```
**Purpose**: Simulate a slow server/network.
**Why**: Requirements: "delayed success (responds after 5–10 seconds)".
**How it works**:
- Line 55: Pick random delay between 5000-10000 ms
- Line 56: Call `delay()` which waits that long
- `.then(() => ...)` executes after the delay completes
- Returns the same success structure as immediate success

**User sees**: "Processing..." (stays for 5-10 seconds) → "Transaction Successful!"

### Line 62-65: Outcome 2 - Temporary Failure
```javascript
  return Promise.reject({
    status: 503,
    message: 'Service temporarily unavailable',
  });
```
**Purpose**: Default case - simulate server error.
**Why**: Requirements: "temporary failure (503)".
**What happens**: 
- Custom hook receives this rejection
- Checks if `status === 503`
- Triggers automatic retry logic
- After 3 failed retries, shows error to user

**HTTP 503**: "Service Unavailable" - standard status code meaning "server is overloaded or down for maintenance, try again later."

---

## 2. Form Submission Hook (`src/hooks/useFormSubmission.js`)

This custom React Hook encapsulates all the complex state management and retry logic, keeping the UI component clean.

### Line 1-2: Imports
```javascript
import { useCallback, useRef, useState } from 'react';
import { submitForm } from '../mockApi';
```
**Purpose**: Import React hooks and our mock API.
**Breakdown**:
- `useCallback`: Memoizes functions to prevent unnecessary re-creation
- `useRef`: Creates mutable values that persist across renders without causing re-renders
- `useState`: Creates reactive state variables that trigger UI updates
- `submitForm`: Our mock API function from `api.js`

### Line 4-10: Status Constants
```javascript
export const SubmissionStatus = Object.freeze({
  IDLE: 'IDLE',
  PENDING: 'PENDING',
  RETRYING: 'RETRYING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
});
```
**Purpose**: Define all possible states the submission can be in.
**Why use an object?**: Prevents typo bugs. Instead of typing string `'PENDING'` everywhere (and risking `'PENDIGN'`), we use `SubmissionStatus.PENDING`.
**Why `Object.freeze`?**: Makes the object immutable - no one can accidentally change `SubmissionStatus.IDLE = 'WRONG'`.

**State Flow**:
```
IDLE → (user clicks submit) → PENDING → (API fails with 503) → RETRYING → ... → SUCCESS or ERROR
```

### Line 12-14: Sleep Helper
```javascript
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```
**Purpose**: Wait before retrying.
**Why**: After a 503 error, we shouldn't hammer the server immediately. Wait a bit (exponential backoff principle).
**Difference from `delay` in api.js**: This is internal to the hook; that one simulates server delay.

### Line 16-18: Retry Checker
```javascript
function isRetryable(err) {
  return err && typeof err === 'object' && err.status === 503;
}
```
**Purpose**: Determine if an error should trigger a retry.
**Why**: Not all errors are worth retrying.
**Logic**:
- `err` exists (not null/undefined)
- `typeof err === 'object'` (it's an object, not just a string)
- `err.status === 503` (specifically a server unavailability error)

**Examples**:
- ✅ `{status: 503, message: '...'}` → Retry
- ❌ `{status: 400, message: 'Bad email'}` → Don't retry (user's fault)
- ❌ `{status: 401, message: 'Unauthorized'}` → Don't retry (auth issue)

### Line 20-21: Hook Declaration & Options
```javascript
export function useFormSubmission(options = {}) {
  const { maxRetries = 3, retryDelayMs = 750 } = options;
```
**Purpose**: Create the custom hook with configurable options.
**Why**: Different parts of the app might need different retry strategies.
**Destructuring with defaults**:
- `maxRetries = 3`: If not provided, default to 3 retries
- `retryDelayMs = 750`: If not provided, wait 750ms between retries

**Usage example**:
```javascript
useFormSubmission({ maxRetries: 5, retryDelayMs: 2000 })
```

### Line 23: Concurrency Lock
```javascript
  const inFlightRef = useRef(false);
```
**Purpose**: Prevent duplicate submissions (requirement!).
**Why `useRef` instead of `useState`?**: 
- Changing it doesn't trigger a re-render
- Value persists across renders
- Its `.current` property is directly mutable

**How it works**:
- `false` = No request is running, button is clickable
- `true` = Request is running, ignore any new clicks

### Line 25-28: State Variables
```javascript
  const [status, setStatus] = useState(SubmissionStatus.IDLE);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
```
**Purpose**: Track the current state of the submission.
**Why separate variables?**: Each serves a distinct purpose and can change independently.

**Breakdown**:
- `status`: Current phase of submission (IDLE, PENDING, etc.)
- `retryCount`: How many retries have happened (for UI display)
- `error`: If it failed, what was the error? (for error messages)
- `result`: If it succeeded, what was returned? (contains transaction ID)

### Line 30-31: Submit Function Declaration
```javascript
  const submit = useCallback(
    async (payload) => {
```
**Purpose**: The function that gets called when user submits the form.
**Why `useCallback`?**: Memoization - React won't recreate this function on every render (unless dependencies change).
**Why `async`?**: We need to `await` API calls.
**Input**: `payload` - The form data `{ email, amount, idempotencyKey }`

### Line 32: Duplicate Prevention Check
```javascript
      if (inFlightRef.current) return;
```
**Purpose**: **CRITICAL** - Prevents duplicate submissions.
**Why**: If user clicks "Pay Now" twice rapidly, the second click does nothing.
**How**: If `inFlightRef.current` is `true` (meaning a request is already running), exit immediately.

**Real-world scenario**:
1. User clicks "Pay Now" → `inFlightRef` set to `true`
2. User clicks again (impatient) → This line blocks it
3. First request completes → `inFlightRef` set back to `false`

### Line 34: Lock Activation
```javascript
      inFlightRef.current = true;
```
**Purpose**: Set the "lock" - we're starting a request.
**Timing**: Must be done BEFORE the API call, so any subsequent clicks are blocked.

### Line 35-38: State Reset
```javascript
      setError(null);
      setResult(null);
      setRetryCount(0);
      setStatus(SubmissionStatus.PENDING);
```
**Purpose**: Clear previous submission data and enter PENDING state.
**Why clear `error` and `result`?**: Imagine submitting twice - old success/error shouldn't linger.
**Why `retryCount = 0`?**: This is a new submission, not a continuation.
**UI Impact**: Button changes to "Processing...", inputs become disabled.

### Line 40-42: Retry Loop
```javascript
      try {
        // attempt #0 + retries up to maxRetries
        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
```
**Purpose**: Automatic retry mechanism (requirement!).
**Why `<= maxRetries`?**: 
- `attempt = 0`: Initial attempt
- `attempt = 1, 2, 3`: Three retries
- Total: 4 attempts (1 initial + 3 retries)

**Example with `maxRetries = 3`**:
- Loop runs 4 times: attempt 0, 1, 2, 3

### Line 43-48: Retry Delay Logic
```javascript
          try {
            if (attempt > 0) {
              setStatus(SubmissionStatus.RETRYING);
              setRetryCount(attempt);
              await sleep(retryDelayMs);
            }
```
**Purpose**: Wait before retrying (after first failure).
**Why `if (attempt > 0)`?**: On the first attempt (`attempt = 0`), don't wait.
**How it works**:
- Change status to RETRYING (UI shows "Retrying...")
- Update `retryCount` (UI shows "Try 1", "Try 2", etc.)
- `await sleep(...)` pauses execution for the configured delay

**Timeline**:
- Attempt 0: No delay
- Attempt 1: Wait `retryDelayMs`, then try
- Attempt 2: Wait again, then try
- Attempt 3: Wait again, then try

### Line 50-53: API Call & Success
```javascript
            const response = await submitForm(payload);
            setResult(response);
            setStatus(SubmissionStatus.SUCCESS);
            return response;
```
**Purpose**: Call the API and handle success.
**Line 50**: `await submitForm(payload)` - Calls our mock API, waits for response or error.
**If succeeds**:
- Line 51: Store the result (has transaction ID)
- Line 52: Change status to SUCCESS (triggers UI update)
- Line 53: Return the response (ends the function)

### Line 54-61: Error Handling
```javascript
          } catch (err) {
            if (isRetryable(err) && attempt < maxRetries) {
              continue;
            }
            setError(err);
            setStatus(SubmissionStatus.ERROR);
            throw err;
          }
```
**Purpose**: Handle API failures.
**Line 55**: Check if we should retry.
- `isRetryable(err)`: Is it a 503?
- `attempt < maxRetries`: Do we have retries left?
**If both true**: `continue` (skip to next loop iteration, doesn't execute lines 58-60)
**If not retryable OR out of retries**:
- Line 58: Store error for UI display
- Line 59: Change status to ERROR
- Line 60: Re-throw error (breaks the loop)

**Example**:
- Attempt 0: Fails with 503 → Retry
- Attempt 1: Fails with 503 → Retry
- Attempt 2: Fails with 503 → Retry
- Attempt 3: Fails with 503 → No more retries → Set ERROR status

### Line 63-65: Cleanup
```javascript
      } finally {
        inFlightRef.current = false;
      }
```
**Purpose**: Release the lock no matter what happens.
**Why `finally`?**: Runs whether we succeed, fail, or crash.
**Critical**: If we didn't do this, a single failure would lock the form forever!

**Scenarios**:
- Success → `finally` runs → Lock released → User can submit again
- Error → `finally` runs → Lock released → User can retry
- Crash → `finally` runs → Lock released → App doesn't break

### Line 66-68: Dependencies
```javascript
    },
    [maxRetries, retryDelayMs]
  );
```
**Purpose**: Tell React when to recreate the `submit` function.
**Why**: If `maxRetries` or `retryDelayMs` change, we need a new function with the new values.
**If omitted**: Stale closures - function would use old values.

### Line 70-76: Reset Function
```javascript
  const reset = useCallback(() => {
    if (inFlightRef.current) return;
    setStatus(SubmissionStatus.IDLE);
    setRetryCount(0);
    setError(null);
    setResult(null);
  }, []);
```
**Purpose**: Clear all state, return to initial state.
**Usage**: Called when user clicks "Send Another" after success.
**Line 71**: Safety check - don't reset while a request is running.
**Line 72-75**: Clear all state back to defaults.
**Line 76**: Empty dependency array `[]` - this function never needs to be recreated.

### Line 78: Return API
```javascript
  return { submit, reset, status, retryCount, error, result };
}
```
**Purpose**: Expose the hook's functionality to components.
**What the component gets**:
- `submit`: Function to call when form is submitted
- `reset`: Function to clear state
- `status`: Current phase (for UI rendering)
- `retryCount`: For display ("Try 2")
- `error`: Error details (for error messages)
- `result`: Success data (transaction ID)

---

## 3. Transaction Form Component (`src/components/TransactionForm.js`)

This is the UI layer - what the user sees and interacts with.

### Line 1-3: Imports
```javascript
import React, { useState } from 'react';
import { useFormSubmission, SubmissionStatus } from '../hooks/useFormSubmission';
import styles from './TransactionForm.module.css';
```
**Purpose**: Import dependencies.
- `React, { useState }`: React library and state hook
- `useFormSubmission, SubmissionStatus`: Our custom hook and status constants
- `styles`: CSS modules for scoped styling

### Line 5-9: Component & Hook Initialization
```javascript
export default function TransactionForm() {
    const { submit, status, retryCount, error, result, reset } = useFormSubmission({
        maxRetries: 3,
        retryDelayMs: 2000,
    });
```
**Purpose**: Define the component and initialize submission logic.
**Line 6-9**: Configure the hook:
- `maxRetries: 3`: Try up to 3 times
- `retryDelayMs: 2000`: Wait 2 seconds between retries (2000ms)
**Destructuring**: Extract all the values returned by the hook.

### Line 11-12: Local Form State
```javascript
    const [email, setEmail] = useState('');
    const [amount, setAmount] = useState('');
```
**Purpose**: Track email and amount input values.
**Why separate from hook state?**: These are UI-only, not submission-related.
**Initial value**: Empty strings (blank inputs).

### Line 14-15: Derived State
```javascript
    const isBusy = status === SubmissionStatus.PENDING || status === SubmissionStatus.RETRYING;
    const isSuccess = status === SubmissionStatus.SUCCESS;
```
**Purpose**: Compute boolean flags for UI logic.
**`isBusy`**: `true` if request is in progress (used to disable inputs/button).
**`isSuccess`**: `true` if submission succeeded (used to show success screen).

### Line 17-35: Submit Handler
```javascript
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!email || !amount) return;

        const idempotencyKey = crypto.randomUUID 
            ? crypto.randomUUID() 
            : `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        submit({
            email,
            amount: Number(amount),
            idempotencyKey,
        }).catch((err) => {
            console.log('Submission failed:', err);
        });
    };
```
**Purpose**: Handle form submission.
**Line 18**: `e.preventDefault()` - Stop browser from refreshing the page.
**Line 19**: Guard clause - exit if fields are empty (shouldn't happen due to `required` attribute).
**Line 21-24**: Generate idempotency key (requirement: "prevent duplicate submissions").
- `crypto.randomUUID()`: Modern browsers have built-in UUID generator
- If not available: Fallback using timestamp + random string
- Example: `txn_1708095234567_k3d9f2x`
**Why?**: If we retry, the server knows it's the same transaction.
**Line 27-31**: Call the hook's `submit` function with the data.
**Line 31-34**: `.catch()` handles the rejected promise (prevents console errors).

### Line 37-41: Reset Handler
```javascript
    const handleReset = () => {
        reset();
        setEmail('');
        setAmount('');
    };
```
**Purpose**: Clear everything and start fresh.
**Usage**: Called when user clicks "Send Another" after success.
**Line 38**: Reset hook state (status, error, etc.)
**Line 39-40**: Clear local input state.

### Line 43-61: Success Screen
```javascript
    if (isSuccess) {
        return (
            <div className={styles.container}>
                <div className={`${styles.statusMessage} ${styles.statusSuccess}`}>
                    <div style={{ ... }}>
                        <span style={{ fontSize: '2rem' }}>🎉</span>
                        <strong>Transaction Successful!</strong>
                        {result?.data?.id && <span ...>ID: {result.data.id}</span>}
                        <button ... onClick={handleReset}>
                            Send Another
                        </button>
                    </div>
                </div>
            </div>
        );
    }
```
**Purpose**: Replace the form with a success message after completion.
**Line 43**: Conditional - only render this if `isSuccess` is `true`.
**Line 46**: Combine CSS classes for styling.
**Line 48**: Emoji for visual appeal.
**Line 50**: Optional chaining `result?.data?.id` - safely access nested properties.
**Line 51**: Show transaction ID if it exists.
**Line 54**: "Send Another" button triggers `handleReset`.

### Line 64-121: Main Form UI
```javascript
    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Payment Details</h2>
            <p className={styles.subtitle}>Securely process your transaction.</p>

            <form onSubmit={handleSubmit} className={styles.form}>
```
**Purpose**: Render the actual form if not in success state.
**Line 66-67**: Title and subtitle.
**Line 69**: Attach `handleSubmit` to form's `onSubmit` event.

### Line 70-82: Email Input
```javascript
                <div className={styles.inputGroup}>
                    <label htmlFor="email" className={styles.label}>Email Address</label>
                    <input
                        id="email"
                        type="email"
                        className={styles.input}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isBusy}
                        required
                        placeholder="you@example.com"
                    />
                </div>
```
**Purpose**: Email input field.
**Line 71**: Label with `htmlFor` linking to input ID (accessibility).
**Line 74**: `type="email"` - Browser validates email format.
**Line 76**: `value={email}` - Controlled component (React manages the value).
**Line 77**: `onChange` - Update state when user types.
**Line 78**: **CRITICAL** - `disabled={isBusy}` prevents editing during submission.
**Line 79**: `required` - HTML5 validation (can't submit empty).
**Line 80**: Placeholder text for UX.

### Line 84-98: Amount Input
```javascript
                <div className={styles.inputGroup}>
                    <label htmlFor="amount" className={styles.label}>Amount ($)</label>
                    <input
                        id="amount"
                        type="number"
                        className={styles.input}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        disabled={isBusy}
                        required
                        min="1"
                        step="0.01"
                        placeholder="0.00"
                    />
                </div>
```
**Purpose**: Amount input field.
**Line 88**: `type="number"` - Only allows numeric input.
**Line 94**: `min="1"` - Prevents negative or zero amounts.
**Line 95**: `step="0.01"` - Allows decimals (for cents).

### Line 100-106: Submit Button
```javascript
                <button type="submit" className={styles.button} disabled={isBusy}>
                    {isBusy ? (
                        status === SubmissionStatus.RETRYING ? 'Retrying Connection...' : 'Processing...'
                    ) : (
                        'Pay Now'
                    )}
                </button>
```
**Purpose**: Submit button with dynamic text.
**Line 100**: **CRITICAL** - `disabled={isBusy}` prevents double-clicks.
**Line 101-105**: Conditional text rendering:
- If busy:
  - If retrying: "Retrying Connection..."
  - If pending: "Processing..."
- If idle/error: "Pay Now"

### Line 108-113: Retry Indicator
```javascript
                {status === SubmissionStatus.RETRYING && (
                    <div className={`${styles.statusMessage} ${styles.statusPending}`}>
                        <span>📡 Connection unstable. Retrying...</span>
                        <span className={styles.retryCount}>Try {retryCount}</span>
                    </div>
                )}
```
**Purpose**: Show retry feedback to user.
**Line 108**: Only render if status is RETRYING.
**Line 111**: Shows current retry attempt number.
**UX Impact**: User sees "📡 Connection unstable. Retrying... Try 2" so they know what's happening.

### Line 115-119: Error Display
```javascript
                {status === SubmissionStatus.ERROR && (
                    <div className={`${styles.statusMessage} ${styles.statusError}`}>
                        <span>⚠️ {error?.message || 'Transaction failed. Please try again.'}</span>
                    </div>
                )}
```
**Purpose**: Show error message if submission fails.
**Line 115**: Only render if status is ERROR.
**Line 117**: Show error message from the API, or fallback generic message.

---

## 4. Component Styles (`src/components/TransactionForm.module.css`)

This file defines the visual appearance using CSS Modules (scoped styles).

### Line 1-12: Container Card
```css
.container {
    background: #ffffff;
    padding: 2.5rem;
    border-radius: 16px;
    box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.08);
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1f2937;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}
```
**Purpose**: The main form card styling.
**Line 2**: White background for contrast.
**Line 4**: `border-radius: 16px` - Rounded corners (modern design).
**Line 5**: `box-shadow` - Soft shadow for depth (card effect).
**Line 7**: `max-width: 480px` - Prevent form from getting too wide on large screens.
**Line 8**: `margin: 0 auto` - Center horizontally.
**Line 9**: Font stack - tries Inter (Google Font), falls back to system fonts.
**Line 11**: `transition` - Smooth animation for hover effect.

### Line 14-17: Hover Effect
```css
.container:hover {
    transform: translateY(-2px);
    box-shadow: 0 20px 50px -12px rgba(0, 0, 0, 0.12);
}
```
**Purpose**: Interactive feedback.
**Line 15**: `translateY(-2px)` - Lift the card 2px up.
**Line 16**: Increase shadow intensity.
**UX**: Subtle "float" effect when mouse hovers over form.

### Line 54-63: Input Fields
```css
.input {
    padding: 0.75rem 1rem;
    border-radius: 8px;
    border: 1px solid #d1d5db;
    font-size: 1rem;
    color: #111827;
    background-color: #fff;
    transition: all 0.2s ease;
    outline: none;
}
```
**Purpose**: Style text/email/number inputs.
**Line 55**: Padding for comfortable touch targets.
**Line 57**: Light gray border.
**Line 61**: `transition` - Smooth animation on focus.
**Line 62**: `outline: none` - Remove default browser outline (we add custom focus style).

### Line 65-68: Focus State
```css
.input:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}
```
**Purpose**: Visual feedback when input is active.
**Line 66**: Change border to blue.
**Line 67**: Add blue glow (3px spread, 10% opacity).
**Accessibility**: Clear indication of which field is active.

### Line 70-74: Disabled Input
```css
.input:disabled {
    background-color: #f3f4f6;
    color: #9ca3af;
    cursor: not-allowed;
}
```
**Purpose**: Visual indication when input is locked (during submission).
**Line 71**: Gray background.
**Line 72**: Lighter text color.
**Line 73**: Cursor changes to "forbidden" symbol.

### Line 76-89: Button
```css
.button {
    margin-top: 0.5rem;
    padding: 0.875rem;
    border-radius: 8px;
    border: none;
    background-color: #2563eb;
    color: white;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
}
```
**Purpose**: Submit button styling.
**Line 81**: Blue background (brand color).
**Line 83**: Bold text (`font-weight: 600`).
**Line 85**: Pointer cursor on hover.

### Line 91-98: Button Hover/Active
```css
.button:hover:not(:disabled) {
    background-color: #1d4ed8;
    transform: translateY(-1px);
}

.button:active:not(:disabled) {
    transform: translateY(0);
}
```
**Purpose**: Interactive feedback.
**Line 91**: `:not(:disabled)` - Only apply hover effect if button is clickable.
**Line 92**: Darker blue on hover.
**Line 93**: Lift button 1px.
**Line 96**: On click, reset position (button "presses down").

### Line 100-103: Disabled Button
```css
.button:disabled {
    background-color: #93c5fd;
    cursor: wait;
}
```
**Purpose**: Visual feedback during submission.
**Line 101**: Lighter blue (indicates unavailable).
**Line 102**: `cursor: wait` - Shows loading spinner cursor.

### Line 105-114: Status Messages
```css
.statusMessage {
    margin-top: 1rem;
    padding: 0.75rem;
    border-radius: 8px;
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    animation: fadeIn 0.3s ease;
}
```
**Purpose**: Base styling for success/error/retry messages.
**Line 110**: Flexbox layout.
**Line 113**: Trigger fade-in animation when displayed.

### Line 116-132: Status Variants
```css
.statusPending {
    background-color: #eff6ff;
    color: #1e40af;
    border: 1px solid #dbeafe;
}

.statusSuccess {
    background-color: #ecfdf5;
    color: #065f46;
    border: 1px solid #d1fae5;
}

.statusError {
    background-color: #fef2f2;
    color: #991b1b;
    border: 1px solid #fee2e2;
}
```
**Purpose**: Color coding for different states.
- **Pending**: Blue tones (information)
- **Success**: Green tones (positive)
- **Error**: Red tones (negative)

### Line 140-150: Fade-in Animation
```css
@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(-5px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}
```
**Purpose**: Smooth appearance of status messages.
**How it works**: Starts invisible and 5px above, transitions to visible and normal position.
**Duration**: 0.3 seconds (set in line 113).

---

## 5. Root App Component (`src/App.js`)

### Line 1-2: Imports
```javascript
import './App.css';
import TransactionForm from './components/TransactionForm';
```
**Purpose**: Import global styles and the form component.

### Line 4-12: App Component
```javascript
function App() {
  return (
    <div className="App">
      <header className="App-header">
        <TransactionForm />
      </header>
    </div>
  );
}
```
**Purpose**: Root component that renders the entire app.
**Structure**: Simple wrapper that contains the TransactionForm.
**Line 8**: Renders our main form component.

### Line 14: Export
```javascript
export default App;
```
**Purpose**: Make component available for import in `index.js`.

---

## 6. App Styles (`src/App.css`)

### App Container
```css
.App {
  text-align: center;
  min-height: 100vh;
  background-color: #f3f4f6;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
```
**Purpose**: Full-page layout.
**Line 3**: `min-height: 100vh` - Fill entire viewport height.
**Line 4**: Light gray background.
**Line 5-8**: Flexbox for centering content.

### Header
```css
.App-header {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
```
**Purpose**: Container for the form (centered).

---

## Summary of How Everything Works Together

1. **User opens app** → `App.js` renders → `TransactionForm.js` shows form
2. **User types email/amount** → React state updates via `useState`
3. **User clicks "Pay Now"** → `handleSubmit` triggers
4. **Idempotency key generated** → Unique ID for this transaction
5. **`submit()` called** → Hook sets `inFlightRef = true`, status = PENDING
6. **UI updates** → Button disabled, shows "Processing..."
7. **API called** → `submitForm()` in `api.js` picks random outcome
8. **If 503 error** → Hook catches it, checks `isRetryable()`, enters retry loop
9. **Retry delay** → Waits 2 seconds, sets status = RETRYING
10. **UI updates** → Shows "📡 Connection unstable. Retrying... Try 1"
11. **Retries** → Up to 3 times
12. **If success** → Sets status = SUCCESS, shows "🎉 Transaction Successful!"
13. **If all retries fail** → Sets status = ERROR, shows "⚠️ Service Temporarily Unavailable"
14. **Lock released** → `inFlightRef = false`, user can submit again

This architecture separates concerns:
- **API logic** → `api.js`
- **State management** → `useFormSubmission.js`
- **UI** → `TransactionForm.js`
- **Styling** → CSS files
