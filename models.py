from enum import Enum
from pydantic import BaseModel

class TransactionStatus(Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    RECONCILED = "RECONCILED"
    FAILED = "FAILED"

class TransactionRecord(BaseModel):
    trans_id: str
    amount: float
    status: TransactionStatus = TransactionStatus.PENDING
