import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TransactionForm from './TransactionForm';
import { submitForm } from '../mockApi';

// Mock the API module.
jest.mock('../mockApi', () => ({
    submitForm: jest.fn(),
}));

describe('TransactionForm Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('renders form correctly', () => {
        render(<TransactionForm />);
        expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Amount/i)).toBeInTheDocument();
    });

    test('handles successful submission', async () => {
        submitForm.mockResolvedValueOnce({
            success: true,
            data: { id: 'test-id-123' }
        });

        render(<TransactionForm />);

        fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'test@example.com' } });
        fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '100' } });

        // Wrap click in act just in case, though fireEvent usually wraps.
        fireEvent.click(screen.getByRole('button', { name: /Pay Now/i }));

        expect(screen.getByText(/Processing.../i)).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText(/Transaction Successful!/i)).toBeInTheDocument();
        });
        expect(screen.getByText(/ID: test-id-123/i)).toBeInTheDocument();
    });

    test('handles retry on 503 error then success', async () => {
        jest.useFakeTimers();

        // Attempt 1: 503
        // Attempt 2: Success
        submitForm
            .mockRejectedValueOnce({ status: 503, message: 'Service temporarily unavailable' })
            .mockResolvedValueOnce({ success: true, data: { id: 'retry-success-id' } });

        render(<TransactionForm />);

        fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'retry@example.com' } });
        fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '50' } });

        fireEvent.click(screen.getByRole('button', { name: /Pay Now/i }));

        // Should see processing initially
        expect(screen.getByText(/Processing.../i)).toBeInTheDocument();

        // The component retryDelay is 2000ms.
        // We need to advance time to trigger the retry.
        // The sequence is:
        // 1. Submit called -> status PENDING.
        // 2. submitForm rejects (503).
        // 3. catch block -> isRetryable -> loop continues.
        // 4. status RETRYING -> await sleep(retryDelayMs).

        // We need to wait for step 4 to happen.
        // Since everything is async (microtasks), we iterate.

        // Wait for the re-rendering that shows "Retrying" or just advance time if we can't see "Retrying" yet?
        // Actually, "Retrying" text appears when status is RETRYING.
        // We should advance time.

        await act(async () => {
            jest.advanceTimersByTime(2500);
        });

        // Check if it retried.
        await waitFor(() => {
            expect(submitForm).toHaveBeenCalledTimes(2);
        });

        await waitFor(() => {
            expect(screen.getByText(/Transaction Successful!/i)).toBeInTheDocument();
        });
    });

    test('handles hard failure (non-503)', async () => {
        submitForm.mockRejectedValueOnce({ status: 400, message: 'Bad Request' });

        render(<TransactionForm />);

        fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'fail@example.com' } });
        fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '10' } });
        fireEvent.click(screen.getByRole('button', { name: /Pay Now/i }));

        await waitFor(() => {
            expect(screen.getByText(/Transaction failed/i)).toBeInTheDocument();
        });
        expect(screen.getByText(/Bad Request/i)).toBeInTheDocument();
    });
});
