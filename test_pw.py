import asyncio
from noon_api.app.services.fetcher_reviews import fetch_product_reviews

async def main():
    reviews = await fetch_product_reviews('Z64D03ED575EEA4F3EFE8Z')
    print("Fetched", len(reviews))

if __name__ == '__main__':
    asyncio.run(main())
