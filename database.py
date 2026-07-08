import asyncpg
import os
import asyncio
from models import TransactionRecord

# Updated with your extracted container credentials
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://synapse_user:synapse_pass@127.0.0.1:5432/synapse")

async def get_db_pool():
    """Creates and returns an async connection pool to PostgreSQL."""
    return await asyncpg.create_pool(DATABASE_URL)

async def init_db():
    """Ensures the transaction_ledger table exists on startup."""
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS transaction_ledger (
                trans_id VARCHAR(255) PRIMARY KEY,
                amount NUMERIC NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    await pool.close()

async def save_transaction(record: TransactionRecord):
    """Saves a new transaction to the database."""
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        await conn.execute('''
            INSERT INTO transaction_ledger (trans_id, amount, status)
            VALUES ($1, $2, $3)
            ON CONFLICT (trans_id) DO NOTHING
        ''', record.trans_id, record.amount, record.status.value)
    await pool.close()

if __name__ == "__main__":
    asyncio.run(init_db())
    print("[+] Database initialized and table verified.")
