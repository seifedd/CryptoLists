import prisma from '../prisma.js';
import { IdempotencyStatus } from '@prisma/client';

interface IdempotencyResult<T> {
    isNew: boolean;
    result: T | null;
}

/**
 * Execute an operation with idempotency guarantees.
 * If the same idempotency key is used, returns the cached result.
 * Uses database-level unique constraints for distributed locking.
 * 
 * @param idempotencyKey - Unique key for this operation (e.g., webhook ID)
 * @param operation - The operation to execute
 * @returns Object indicating if this was a new operation and the result
 */
export async function withIdempotency<T>(
    idempotencyKey: string,
    operation: () => Promise<T>
): Promise<IdempotencyResult<T>> {

    // Check if already processed
    const existing = await prisma.idempotencyRecord.findUnique({
        where: { key: idempotencyKey }
    });

    if (existing) {
        console.log(`Duplicate request detected: ${idempotencyKey}`);
        return {
            isNew: false,
            result: existing.response as T
        };
    }

    // Acquire lock and process using transaction
    try {
        const result = await prisma.$transaction(async (tx) => {
            // Insert with unique constraint acts as distributed lock
            await tx.idempotencyRecord.create({
                data: {
                    key: idempotencyKey,
                    status: IdempotencyStatus.PROCESSING,
                    createdAt: new Date()
                }
            });

            // Execute the actual operation
            const operationResult = await operation();

            // Store result for future duplicate detection
            await tx.idempotencyRecord.update({
                where: { key: idempotencyKey },
                data: {
                    status: IdempotencyStatus.COMPLETED,
                    response: JSON.stringify(operationResult),
                    completedAt: new Date()
                }
            });

            return operationResult;
        });

        return { isNew: true, result };
    } catch (error: any) {
        // Unique constraint violation = concurrent duplicate request
        if (error.code === 'P2002') {
            console.log(`Concurrent duplicate detected: ${idempotencyKey}`);
            return { isNew: false, result: null };
        }

        // Mark as failed for other errors
        try {
            await prisma.idempotencyRecord.update({
                where: { key: idempotencyKey },
                data: {
                    status: IdempotencyStatus.FAILED,
                    completedAt: new Date()
                }
            });
        } catch {
            // Ignore cleanup errors
        }

        throw error;
    }
}

/**
 * Clean up old idempotency records (older than 24 hours).
 * Should be run periodically via cron job.
 */
export async function cleanupIdempotencyRecords(): Promise<number> {
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await prisma.idempotencyRecord.deleteMany({
        where: {
            createdAt: { lt: cutoffDate },
            status: { in: [IdempotencyStatus.COMPLETED, IdempotencyStatus.FAILED] }
        }
    });

    console.log(`Cleaned up ${result.count} old idempotency records`);
    return result.count;
}
