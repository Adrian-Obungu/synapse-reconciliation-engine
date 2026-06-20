import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI(title="eTIMS Mock Service")

@app.post("/saveVscu")
async def save_vscu(request: Request):
    # Simulate a realistic upstream 30ms latency overhead
    await asyncio.sleep(0.03)

    # In a real environment, we'd validate the incoming Pydantic schema here,
    # but for a high-throughput dummy sink, we just return a 200 OK.
    return JSONResponse(
        content={
            "response_code": "00",
            "response_description": "Successful",
            "invoice_number": "MOCK-INV-12345"
        },
        status_code=200
    )
