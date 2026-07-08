import asyncio
import logging
from database import get_db_pool

# OpenTelemetry Imports
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SimpleSpanProcessor, ConsoleSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource

# Set up clean logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("reconciliation-worker")

# Initialize OpenTelemetry with an explicit service name
provider = TracerProvider(resource=Resource.create({"service.name": "synapse-worker"}))

# Processor 1: Mirror traces directly to your local PowerShell terminal window instantly
provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))

# Processor 2: Background batching to your Docker OTel collector
try:
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint="http://127.0.0.1:4317", insecure=True)))
except Exception:
    pass

trace.set_tracer_provider(provider)
tracer = trace.get_tracer("synapse.worker")

async def fetch_pending_transactions(pool):
    async with pool.acquire() as conn:
        return await conn.fetch(
            "SELECT trans_id, amount FROM transaction_ledger WHERE status = 'PENDING' ORDER BY created_at ASC"
        )

async def update_transaction_status(pool, trans_id: str, status: str):
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE transaction_ledger SET status = $1 WHERE trans_id = $2",
            status, trans_id
        )

async def reconcile_transaction(trans_id: str, amount: float):
    # Open a distributed tracing span for this explicit transaction
    with tracer.start_as_current_span("reconcile_transaction_kes") as span:
        span.set_attribute("transaction.id", trans_id)
        span.set_attribute("transaction.amount_kes", amount)
        
        logger.info(f"[*] Processing Transaction {trans_id} ({amount} KSh)...")
        await asyncio.sleep(1.5) # Simulating external API network lag
        
        span.set_attribute("transaction.reconciliation_status", "SUCCESS")
        return True

async def worker_loop():
    logger.info("[+] Reconciliation Background Worker with Live Console Telemetry initialized.")
    pool = await get_db_pool()
    
    try:
        while True:
            pending_txs = await fetch_pending_transactions(pool)
            
            if pending_txs:
                logger.info(f"[!] Found {len(pending_txs)} pending transaction(s) to reconcile.")
                for tx in pending_txs:
                    trans_id = tx['trans_id']
                    amount = float(tx['amount'])
                    
                    success = await reconcile_transaction(trans_id, amount)
                    
                    if success:
                        await update_transaction_status(pool, trans_id, "RECONCILED")
                        logger.info(f"[?] Transaction {trans_id} successfully RECONCILED.")
                    else:
                        await update_transaction_status(pool, trans_id, "FAILED")
                        logger.error(f"[X] Transaction {trans_id} reconciliation FAILED.")
            
            await asyncio.sleep(5)
            
    except asyncio.CancelledError:
        logger.info("[-] Worker shutting down cleanly.")
    finally:
        await pool.close()

if __name__ == "__main__":
    try:
        asyncio.run(worker_loop())
    except KeyboardInterrupt:
        pass
