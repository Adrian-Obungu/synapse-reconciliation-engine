import logging
import time
import redis.asyncio as redis
import asyncpg
from typing import Optional
from app.schemas.etims import ETIMSInvoicePayload
from app.core.config import settings

logger = logging.getLogger(__name__)

class StorageEngine:
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.pg_pool: Optional[asyncpg.Pool] = None

    async def startup(self):
        try:
            self.redis_client = redis.from_url(settings.redis_url, decode_responses=True)
            self.pg_pool = await asyncpg.create_pool(dsn=settings.postgres_dsn)
            logger.info("StorageEngine connected securely to Redis and Postgres.")
        except Exception as e:
            logger.exception(f"StorageEngine failed to start: {e}")
            raise

    async def shutdown(self):
        if self.redis_client:
            await self.redis_client.aclose()
        if self.pg_pool:
            await self.pg_pool.close()
        logger.info("StorageEngine connections gracefully closed.")

    async def check_idempotency(self, tx_id: str) -> bool:
        """
        Uses Redis SET NX EX to atomically set a key with an expiration window (e.g. 24 hours).
        Returns True if the transaction is novel (was not present and is now locked).
        Returns False if the transaction is a duplicate (was already locked).
        """
        if not self.redis_client:
            logger.warning("Redis client is not available. Idempotency fallback passed through.")
            return True

        try:
            # Expire idempotency lock after 86400 seconds (24 hours)
            acquired = await self.redis_client.set(f"idemp:{tx_id}", "LOCKED", nx=True, ex=86400)
            return bool(acquired)
        except Exception as e:
            logger.exception(f"Failed to check idempotency in Redis: {e}")
            return True # Fail open on redis dropout to preserve availability

    async def commit_ledger_record(self, payload: ETIMSInvoicePayload) -> None:
        """
        Raw asyncpg commit utilizing the persistent connection pool.
        """
        log_context = {
            "checkout_request_id": payload.transaction_reference,
            "mpesa_receipt_number": payload.invoice_number
        }

        if not self.pg_pool:
            logger.warning("[StorageEngine] Postgres pool is not available. Skipping append.", extra=log_context)
            return

        query = """
            INSERT INTO ledger_audit (
                transaction_reference, invoice_number, amount,
                customer_phone, transaction_date, status, sender_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        """

        start_time = time.perf_counter()

        try:
            async with self.pg_pool.acquire() as connection:
                await connection.execute(
                    query,
                    payload.transaction_reference,
                    payload.invoice_number,
                    payload.amount,
                    payload.customer_phone,
                    payload.transaction_date,
                    payload.status,
                    payload.sender_id
                )
        except Exception as e:
            elapsed_time = time.perf_counter() - start_time
            log_context["io_latency_warning"] = elapsed_time > 0.05
            logger.exception(f"[StorageEngine] Failed to commit to Postgres: {e}", extra=log_context)
            raise
        else:
            elapsed_time = time.perf_counter() - start_time
            log_context["io_latency_warning"] = elapsed_time > 0.05
            logger.info(f"[StorageEngine] Successfully committed to Ledger", extra=log_context)
