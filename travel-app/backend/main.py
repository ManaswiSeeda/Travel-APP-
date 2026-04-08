from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import httpx
import os

load_dotenv()

app = FastAPI(title="Travel Agent Orchestrator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY", "")
SKY_HOST = os.getenv("SKY_HOST", " skyscanner-flights-travel-api.p.rapidapi.com")
BOOKING_HOST = os.getenv("BOOKING_HOST", "booking-com15.p.rapidapi.com")
WEATHER_HOST = os.getenv("WEATHER_HOST", "open-weather13.p.rapidapi.com")


def rapid_headers(host: str) -> dict:
    return {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": host,
    }


def mins_to_text(minutes: int) -> str:
    if not minutes:
        return ""
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours}h {mins}m" if hours else f"{mins}m"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/flights")
async def search_flights(
    origin: str = Query(...),
    destination: str = Query(...),
    departure_date: str = Query(...),
    return_date: str | None = Query(None),
    adults: int = Query(1),
    cabin_class: str = Query("economy"),
):
    if not RAPIDAPI_KEY:
        raise HTTPException(status_code=500, detail="Missing RAPIDAPI_KEY")

    async with httpx.AsyncClient(timeout=40) as client:
        origin_res = await client.get(
            f"https://{SKY_HOST}/api/v1/flights/searchAirport",
            params={"query": origin},
            headers=rapid_headers(SKY_HOST),
        )
        if origin_res.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Origin airport lookup failed: {origin_res.text}")

        dest_res = await client.get(
            f"https://{SKY_HOST}/api/v1/flights/searchAirport",
            params={"query": destination},
            headers=rapid_headers(SKY_HOST),
        )
        if dest_res.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Destination airport lookup failed: {dest_res.text}")

        origin_data = origin_res.json()
        dest_data = dest_res.json()
        origin_airports = origin_data.get("data", [])
        dest_airports = dest_data.get("data", [])

        if not origin_airports or not dest_airports:
            raise HTTPException(status_code=404, detail="Airport not found")

        origin_item = origin_airports[0]
        dest_item = dest_airports[0]

        params = {
            "originSkyId": origin_item.get("skyId"),
            "destinationSkyId": dest_item.get("skyId"),
            "originEntityId": origin_item.get("entityId"),
            "destinationEntityId": dest_item.get("entityId"),
            "date": departure_date,
            "adults": adults,
            "cabinClass": cabin_class,
            "currency": "INR",
            "market": "IN",
            "locale": "en-IN",
        }
        if return_date:
            params["returnDate"] = return_date

        flights_res = await client.get(
            f"https://{SKY_HOST}/api/v1/flights/searchFlights",
            params=params,
            headers=rapid_headers(SKY_HOST),
        )
        if flights_res.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Flight search failed: {flights_res.text}")

        raw = flights_res.json()
        itineraries = raw.get("data", {}).get("itineraries", []) or raw.get("itineraries", [])

        flights = []
        for item in itineraries[:10]:
            legs = item.get("legs", [])
            first_leg = legs[0] if legs else {}
            carriers = first_leg.get("carriers", {})
            marketing = carriers.get("marketing", [])
            airline_name = marketing[0].get("name", "Unknown Airline") if marketing else "Unknown Airline"
            price_obj = item.get("price", {})
            duration_mins = first_leg.get("durationInMinutes", 0)

            flights.append({
                "airline": airline_name,
                "dep": first_leg.get("departure", ""),
                "arr": first_leg.get("arrival", ""),
                "stops": first_leg.get("stopCount", 0),
                "duration": duration_mins,
                "durationText": mins_to_text(duration_mins),
                "price": price_obj.get("raw", 0),
                "formattedPrice": price_obj.get("formatted", ""),
                "raw": item,
            })

        return {"flights": flights}


@app.get("/api/hotels")
async def search_hotels(
    city: str = Query(...),
    checkin: str = Query(...),
    checkout: str = Query(...),
    adults: int = Query(1),
    room_qty: int = Query(1),
):
    if not RAPIDAPI_KEY:
        raise HTTPException(status_code=500, detail="Missing RAPIDAPI_KEY")

    async with httpx.AsyncClient(timeout=40) as client:
        dest_res = await client.get(
            f"https://{BOOKING_HOST}/api/v1/hotels/searchDestination",
            params={"query": city},
            headers=rapid_headers(BOOKING_HOST),
        )
        if dest_res.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Destination search failed: {dest_res.text}")

        dest_json = dest_res.json()
        destinations = dest_json.get("data", [])
        if not destinations:
            raise HTTPException(status_code=404, detail="No hotel destination found")

        first_dest = destinations[0]
        dest_id = first_dest.get("dest_id")
        search_type = first_dest.get("search_type")
        if not dest_id or not search_type:
            raise HTTPException(status_code=500, detail="dest_id/search_type missing")

        hotel_res = await client.get(
            f"https://{BOOKING_HOST}/api/v1/hotels/searchHotels",
            params={
                "dest_id": dest_id,
                "search_type": search_type,
                "arrival_date": checkin,
                "departure_date": checkout,
                "adults": adults,
                "room_qty": room_qty,
                "page_number": 1,
                "units": "metric",
                "temperature_unit": "c",
                "languagecode": "en-us",
                "currency_code": "INR",
            },
            headers=rapid_headers(BOOKING_HOST),
        )
        if hotel_res.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Hotel search failed: {hotel_res.text}")

        raw = hotel_res.json()
        results = raw.get("data", {}).get("hotels", []) or raw.get("data", [])

        hotels = []
        for item in results[:10]:
            prop = item.get("property", item)
            gross = prop.get("priceBreakdown", {}).get("grossPrice", {})
            hotels.append({
                "name": prop.get("name", "Unknown Hotel"),
                "rating": prop.get("reviewScore", 0),
                "price": gross.get("value", 0),
                "formattedPrice": gross.get("currency") and gross.get("value") and f"{gross.get('currency')} {gross.get('value')}" or "",
                "currency": gross.get("currency", "INR"),
                "area": prop.get("wishlistName", city),
                "amenities": [],
                "raw": item,
            })

        return {"hotels": hotels}


@app.get("/api/climate")
async def climate(city: str = Query(...), lang: str = Query("EN")):
    if not RAPIDAPI_KEY:
        raise HTTPException(status_code=500, detail="Missing RAPIDAPI_KEY")

    async with httpx.AsyncClient(timeout=30) as client:
        current_res = await client.get(
            f"https://{WEATHER_HOST}/city/{city}/{lang}",
            headers=rapid_headers(WEATHER_HOST),
        )
        if current_res.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Weather lookup failed: {current_res.text}")

        data = current_res.json()
        main = data.get("main", {})
        weather_list = data.get("weather", [])
        weather_text = weather_list[0].get("description", "") if weather_list else ""

        return {
            "temp": f"{round(main.get('temp', 0))}°C",
            "humidity": f"{main.get('humidity', 0)}%",
            "condition": weather_text or "N/A",
            "rain": "N/A",
            "advisory": "Carry umbrella" if "rain" in weather_text.lower() else "Weather looks manageable",
            "raw": data,
        }
