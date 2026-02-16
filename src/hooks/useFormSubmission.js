import { useCallback, useRef, useState } from 'react';
import { submitForm } from '../mockApi';

export const SubmissionStatus = Object.freeze({
  IDLE: 'IDLE',
  PENDING: 'PENDING',
  RETRYING: 'RETRYING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(err) {
  return err && typeof err === 'object' && err.status === 503;
}

export function useFormSubmission(options = {}) {
  const { maxRetries = 3, retryDelayMs = 750 } = options;

  const inFlightRef = useRef(false);

  const [status, setStatus] = useState(SubmissionStatus.IDLE);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const submit = useCallback(
    async (payload) => {
      if (inFlightRef.current) return;

      inFlightRef.current = true;
      setError(null);
      setResult(null);
      setRetryCount(0);
      setStatus(SubmissionStatus.PENDING);

      try {
        // attempt #0 + retries up to maxRetries
        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
          try {
            if (attempt > 0) {
              setStatus(SubmissionStatus.RETRYING);
              setRetryCount(attempt);
              await sleep(retryDelayMs);
            }

            const response = await submitForm(payload);
            setResult(response);
            setStatus(SubmissionStatus.SUCCESS);
            return response;
          } catch (err) {
            if (isRetryable(err) && attempt < maxRetries) {
              continue;
            }
            setError(err);
            setStatus(SubmissionStatus.ERROR);
            throw err;
          }
        }
      } finally {
        inFlightRef.current = false;
      }
    },
    [maxRetries, retryDelayMs]
  );

  const reset = useCallback(() => {
    if (inFlightRef.current) return;
    setStatus(SubmissionStatus.IDLE);
    setRetryCount(0);
    setError(null);
    setResult(null);
  }, []);

  return { submit, reset, status, retryCount, error, result };
}

