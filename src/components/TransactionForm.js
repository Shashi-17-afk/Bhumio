import React, { useState } from 'react';
import { useFormSubmission, SubmissionStatus } from '../hooks/useFormSubmission';
import styles from './TransactionForm.module.css';

export default function TransactionForm() {
    const { submit, status, retryCount, error, result, reset } = useFormSubmission({
        maxRetries: 3,
        retryDelayMs: 2000, // Slightly longer delay for better UX visibility
    });

    const [email, setEmail] = useState('');
    const [amount, setAmount] = useState('');

    const isBusy = status === SubmissionStatus.PENDING || status === SubmissionStatus.RETRYING;
    const isSuccess = status === SubmissionStatus.SUCCESS;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!email || !amount) return;

        // Generate a simple client-side idempotency key
        // in a real app, this might come from a robust UUID library
        const idempotencyKey = crypto.randomUUID
            ? crypto.randomUUID()
            : `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        submit({
            email,
            amount: Number(amount),
            idempotencyKey,
        }).catch((err) => {
            // Error is already handled via the hook's 'status' and 'error' state
            console.log('Submission failed:', err);
        });
    };

    const handleReset = () => {
        reset();
        setEmail('');
        setAmount('');
    };

    if (isSuccess) {
        return (
            <div className={styles.container}>
                <div className={`${styles.statusMessage} ${styles.statusSuccess}`}>
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '8px', textAlign: 'center', padding: '1rem 0' }}>
                        <span style={{ fontSize: '2rem' }}>🎉</span>
                        <strong>Transaction Successful!</strong>
                        {result?.data?.id && <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>ID: {result.data.id}</span>}
                        <button
                            className={styles.button}
                            onClick={handleReset}
                            style={{ marginTop: '1rem', backgroundColor: '#10b981' }}
                        >
                            Send Another
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Payment Details</h2>
            <p className={styles.subtitle}>Securely process your transaction.</p>

            <form onSubmit={handleSubmit} className={styles.form}>
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

                <button type="submit" className={styles.button} disabled={isBusy}>
                    {isBusy ? (
                        status === SubmissionStatus.RETRYING ? 'Retrying Connection...' : 'Processing...'
                    ) : (
                        'Pay Now'
                    )}
                </button>

                {status === SubmissionStatus.RETRYING && (
                    <div className={`${styles.statusMessage} ${styles.statusPending}`}>
                        <span>📡 Connection unstable. Retrying...</span>
                        <span className={styles.retryCount}>Try {retryCount}</span>
                    </div>
                )}

                {status === SubmissionStatus.ERROR && (
                    <div className={`${styles.statusMessage} ${styles.statusError}`}>
                        <span>⚠️ {error?.message || 'Transaction failed. Please try again.'}</span>
                    </div>
                )}
            </form>
        </div>
    );
}
