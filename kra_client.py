import asyncio
import json
from datetime import datetime

def get_env_from_file(filename='.env'):
    env = {}
    try:
        with open(filename, 'r', encoding='utf-8-sig') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    key, val = line.strip().split('=', 1)
                    env[key.strip()] = val.strip()
    except FileNotFoundError:
        pass
    return env

async def initialize_etims_device():
    env = get_env_from_file()
    pin = env.get("KRA_PIN", "P051109164C")
    bhf = env.get("KRA_BHF_ID", "00")
    dvc = env.get("KRA_DVC_SRL_NO", "KRACU0200102502")
    
    print("[*] Engaging Structurally Accurate Sandbox Mock...")
    await asyncio.sleep(0.3) # Simulate network latency
    
    # Generate timestamp in strict KRA format
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    
    # Factual, schema-compliant KRA successful response
    mock_kra_response = {
        "resultCd": "000",
        "resultMsg": "Successful",
        "resultDt": timestamp,
        "data": {
            "info": {
                "taxprNm": "SYNAPSE RECONCILIATION DEV",
                "taxprSttsCd": "01",
                "prvncNm": "Nairobi",
                "dvcSrlNo": dvc,
                # Realistic 64-character communication key
                "cmcKey": "A1B2C3D4E5F6G7H8I9J0A1B2C3D4E5F6G7H8I9J0A1B2C3D4E5F6G7H8I9J01234", 
                "initlNo": "1000123456"
            }
        }
    }
    
    # In production, we extract the key. Here we simulate that extraction.
    if mock_kra_response.get("resultCd") == "000":
        cmc_key = mock_kra_response["data"]["info"]["cmcKey"]
        print(f"[+] Handshake Successful.")
        print(f"[+] Validated cmcKey: {cmc_key[:10]}...{cmc_key[-10:]}")
        return mock_kra_response
    else:
        raise Exception("Mock initialization failed.")

if __name__ == '__main__':
    asyncio.run(initialize_etims_device())
