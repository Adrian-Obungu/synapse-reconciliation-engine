from fastapi import FastAPI, Request, Header, HTTPException
import redis.asyncio as redis
from models import TransactionRecord, TransactionStatus
from database import save_transaction

app = FastAPI()

# Host connection to Dockerized Redis
redis_client = redis.Redis(host='127.0.0.1', port=6379, db=0, decode_responses=True)

@app.post("/mpesa/webhook")
async def mpesa_webhook(request: Request, x_signature: str = Header(None)):
    # 1. Mandatory Security Mandate Verification
    if not x_signature:
        raise HTTPException(status_code=401, detail="Missing signature")
    
    # 2. Parse Incoming Payload
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    trans_id = data.get('TransID')
    amount = data.get('Amount')
    
    if not trans_id or amount is None:
        raise HTTPException(status_code=400, detail="Missing TransID or Amount")

    # 3. Idempotency Layer (Redis Lock)
    if not await redis_client.set(f"tx:{trans_id}", "processed", nx=True, ex=86400):
        print(f"[-] Duplicate Transaction {trans_id} blocked via Redis.")
        return {"ResultCode": 1, "ResultDesc": "Duplicate Ignored"}
        
    # 4. Persistence Layer (PostgreSQL Outbox Storage)
    try:
        record = TransactionRecord(
            trans_id=trans_id,
            amount=float(amount),
            status=TransactionStatus.PENDING
        )
        await save_transaction(record)
    except Exception as e:
        # Fail-closed architecture: if database storage fails, release Redis lock and error out
        await redis_client.delete(f"tx:{trans_id}")
        print(f"[!] Database Persistence Failure: {e}")
        raise HTTPException(status_code=500, detail="Internal Engine Error")
        
    print(f"[+] Secure Transaction {trans_id} ({amount} KSh) stored as PENDING.")
    return {"ResultCode": 0, "ResultDesc": "Accepted"}
