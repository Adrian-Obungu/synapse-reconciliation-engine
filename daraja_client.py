import httpx
import base64
import time
import os

class DarajaClient:
    def __init__(self):
        self.key = "qOcAi5NWuGVohArxjImE7XromMlmmGll7mIOAZCxk4GhqKbp"
        self.secret = "YlZWNGYtTZI0mifZuuZ30GDSINGVHHRsTaKWwG2euRg7kAGGjrAQM0A11qzvUWYa"
        self.token = None
        self.expiry = 0

    def get_auth_header(self):
        credentials = f"{self.key}:{self.secret}"
        return base64.b64encode(credentials.encode()).decode()

    async def refresh_token(self):
        url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
        headers = {"Authorization": f"Basic {self.get_auth_header()}"}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            data = response.json()
            self.token = data['access_token']
            self.expiry = time.time() + int(data['expires_in'])
            print("[+] Daraja Auth: Token refreshed successfully.")

    async def get_token(self):
        if not self.token or time.time() >= self.expiry:
            await self.refresh_token()
        return self.token

# Initialize for use in other modules
client = DarajaClient()
