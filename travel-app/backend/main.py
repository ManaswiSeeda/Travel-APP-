from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import httpx
import os
from pydantic import BaseModel, field_validator, model_validator
from typing import Literal, Optional
from datetime import date

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
SKY_HOST = os.getenv("SKY_HOST", "google-flights2.p.rapidapi.com")
BOOKING_HOST = os.getenv("BOOKING_HOST", "booking-com15.p.rapidapi.com")
WEATHER_HOST = os.getenv("WEATHER_HOST", "open-weather13.p.rapidapi.com")


def rapid_headers(host: str) -> dict:
    return {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": host,
        "Content-Type": "application/json",
    }


def mins_to_text(minutes: int) -> str:
    if not minutes:
        return ""
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours}h {mins}m" if hours else f"{mins}m"


def debug_log(label: str, url: str, params: dict | None = None):
    print("\n===== API DEBUG =====")
    print("LABEL:", label)
    print("URL:", url)
    print("PARAMS:", params or {})
    print("=====================\n")


def map_travel_class(cabin_class: str) -> str:
    value = (cabin_class or "").strip().lower()
    mapping = {
        "economy": "ECONOMY",
        "premium economy": "PREMIUM_ECONOMY",
        "premium_economy": "PREMIUM_ECONOMY",
        "business": "BUSINESS",
        "first": "FIRST",
    }
    return mapping.get(value, "ECONOMY")


class TripValidation(BaseModel):
    origin: str
    destination: str
    departure_date: date
    return_date: Optional[date] = None
    adults: int
    trip_type: Literal["oneway", "roundtrip"]
    stops: Literal["nonstop", "1 stop", "any"]
    budget: float

    @field_validator("origin", "destination")
    @classmethod
    def validate_city(cls, value: str):
        if not value or not value.strip():
            raise ValueError("City is required")
        cleaned = value.replace(" ", "").replace("-", "")
        if not cleaned.isalpha():
            raise ValueError("City must contain letters only")
        return value.strip()

    @field_validator("adults")
    @classmethod
    def validate_adults(cls, value: int):
        if value < 1:
            raise ValueError("At least 1 traveler required")
        if value > 9:
            raise ValueError("Maximum 9 travelers allowed")
        return value

    @field_validator("budget")
    @classmethod
    def validate_budget(cls, value: float):
        if value <= 0:
            raise ValueError("Budget must be greater than 0")
        return value

    @field_validator("departure_date")
    @classmethod
    def validate_departure_date(cls, value: date):
        if value < date.today():
            raise ValueError("Departure date cannot be in the past")
        return value

    @model_validator(mode="after")
    def validate_trip(self):
        if self.origin.strip().lower() == self.destination.strip().lower():
            raise ValueError("Origin and destination cannot be the same")

        if self.trip_type == "roundtrip":
            if not self.return_date:
                raise ValueError("Return date is required for roundtrip")
            if self.return_date <= self.departure_date:
                raise ValueError("Return date must be after departure date")

        return self


@app.get("/health")
def health():
    return {
        "status": "ok",
        "rapidapi_key_loaded": bool(RAPIDAPI_KEY),
        "sky_host": SKY_HOST,
        "booking_host": BOOKING_HOST,
        "weather_host": WEATHER_HOST,
    }


@app.get("/api/flights")
async def search_flights(
    origin: str = Query(...),
    destination: str = Query(...),
    departure_date: str = Query(...),
    return_date: str | None = Query(None),
    adults: int = Query(1),
    cabin_class: str = Query("economy"),
):
    trip_type = "roundtrip" if return_date else "oneway"

    TripValidation(
        origin=origin,
        destination=destination,
        departure_date=departure_date,
        return_date=return_date,
        adults=adults,
        trip_type=trip_type,
        stops="any",
        budget=1000,
    )

    if not RAPIDAPI_KEY:
        raise HTTPException(status_code=500, detail="Missing RAPIDAPI_KEY")

    async with httpx.AsyncClient(timeout=45) as client:
        airport_url = f"https://{SKY_HOST}/api/v1/searchAirport"

        origin_params = {"query": origin}
        debug_log("FLIGHT ORIGIN AIRPORT SEARCH", airport_url, origin_params)
        origin_res = await client.get(
            airport_url,
            params=origin_params,
            headers=rapid_headers(SKY_HOST),
        )
        if origin_res.status_code != 200:
            raise HTTPException(
                status_code=500,
                detail=f"Origin airport lookup failed: {origin_res.text}",
            )

        dest_params = {"query": destination}
        debug_log("FLIGHT DESTINATION AIRPORT SEARCH", airport_url, dest_params)
        dest_res = await client.get(
            airport_url,
            params=dest_params,
            headers=rapid_headers(SKY_HOST),
        )
        if dest_res.status_code != 200:
            raise HTTPException(
                status_code=500,
                detail=f"Destination airport lookup failed: {dest_res.text}",
            )

        origin_json = origin_res.json()
        dest_json = dest_res.json()

        origin_data = origin_json.get("data", [])
        dest_data = dest_json.get("data", [])

        if not origin_data:
            raise HTTPException(status_code=404, detail=f"No airport found for origin: {origin}")
        if not dest_data:
            raise HTTPException(status_code=404, detail=f"No airport found for destination: {destination}")

        origin_item = origin_data[0]
        dest_item = dest_data[0]

        departure_id = (
            origin_item.get("id")
            or origin_item.get("airport_code")
            or origin_item.get("iata_code")
            or origin_item.get("skyId")
        )
        arrival_id = (
            dest_item.get("id")
            or dest_item.get("airport_code")
            or dest_item.get("iata_code")
            or dest_item.get("skyId")
        )

        if not departure_id or not arrival_id:
            raise HTTPException(
                status_code=500,
                detail={
                    "message": "Could not extract airport IDs from provider response",
                    "origin_item": origin_item,
                    "destination_item": dest_item,
                },
            )

        flight_url = f"https://{SKY_HOST}/api/v1/searchFlights"
        flight_params = {
            "departure_id": departure_id,
            "arrival_id": arrival_id,
            "outbound_date": departure_date,
            "adults": adults,
            "travel_class": map_travel_class(cabin_class),
            "currency": "USD",
            "country_code": "US",
            "language_code": "en-US",
            "type": "1" if return_date else "2",
        }

        if return_date:
            flight_params["return_date"] = return_date

        debug_log("FLIGHT SEARCH", flight_url, flight_params)
        flights_res = await client.get(
            flight_url,
            params=flight_params,
            headers=rapid_headers(SKY_HOST),
        )
        if flights_res.status_code != 200:
            raise HTTPException(
                status_code=500,
                detail=f"Flight search failed: {flights_res.text}",
            )

        raw = flights_res.json()
        print("===== FULL FLIGHT API RESPONSE =====")
        print(raw)
        print("====================================")

        all_flights = []

        if isinstance(raw, dict):
            data = raw.get("data")

            if isinstance(data, dict):
                for key in [
                    "best_flights",
                    "other_flights",
                    "flights",
                    "results",
                    "itineraries",
                    "items",
                ]:
                    value = data.get(key, [])
                    if isinstance(value, list) and value:
                        all_flights = value
                        print(f"FOUND FLIGHTS UNDER data['{key}']")
                        break

                # if one of these keys is a dict instead of list, unwrap inner list
                if not all_flights:
                    for key in [
                        "best_flights",
                        "other_flights",
                        "flights",
                        "results",
                        "itineraries",
                        "items",
                    ]:
                        value = data.get(key)
                        if isinstance(value, dict):
                            for inner_key in ["items", "results", "flights", "itineraries"]:
                                inner_value = value.get(inner_key, [])
                                if isinstance(inner_value, list) and inner_value:
                                    all_flights = inner_value
                                    print(f"FOUND FLIGHTS UNDER data['{key}']['{inner_key}']")
                                    break
                        if all_flights:
                            break

            elif isinstance(data, list):
                all_flights = data
                print("FOUND FLIGHTS UNDER data list")

        if not all_flights and isinstance(raw, dict):
            for key in [
                "flights",
                "results",
                "itineraries",
                "items",
                "best_flights",
                "other_flights",
            ]:
                value = raw.get(key, [])
                if isinstance(value, list) and value:
                    all_flights = value
                    print(f"FOUND FLIGHTS UNDER raw['{key}']")
                    break

            if not all_flights:
                for key in [
                    "flights",
                    "results",
                    "itineraries",
                    "items",
                    "best_flights",
                    "other_flights",
                ]:
                    value = raw.get(key)
                    if isinstance(value, dict):
                        for inner_key in ["items", "results", "flights", "itineraries"]:
                            inner_value = value.get(inner_key, [])
                            if isinstance(inner_value, list) and inner_value:
                                all_flights = inner_value
                                print(f"FOUND FLIGHTS UNDER raw['{key}']['{inner_key}']")
                                break
                    if all_flights:
                        break

        if not isinstance(all_flights, list):
            print("WARNING: all_flights is not a list, converting to empty list")
            print("ACTUAL TYPE:", type(all_flights))
            print("ACTUAL VALUE:", all_flights)
            all_flights = []

        print("PARSED FLIGHTS COUNT:", len(all_flights))

        flights = []
        for item in all_flights[:10]:
            if not isinstance(item, dict):
                continue

            flights_list = (
                item.get("flights", [])
                or item.get("legs", [])
                or item.get("segments", [])
                or item.get("itinerary", [])
            )

            if isinstance(flights_list, dict):
                flights_list = (
                    flights_list.get("segments", [])
                    or flights_list.get("legs", [])
                    or flights_list.get("flights", [])
                    or []
                )

            first_leg = flights_list[0] if isinstance(flights_list, list) and flights_list else {}
            last_leg = flights_list[-1] if isinstance(flights_list, list) and flights_list else {}

            airline_name = (
                first_leg.get("airline")
                or first_leg.get("name")
                or first_leg.get("carrier")
                or item.get("airline")
                or item.get("name")
                or "Unknown Airline"
            )

            dep = (
                first_leg.get("departure_airport", {}).get("time")
                or first_leg.get("departure")
                or first_leg.get("dep")
                or item.get("departure")
                or item.get("dep")
                or ""
            )

            arr = (
                last_leg.get("arrival_airport", {}).get("time")
                or last_leg.get("arrival")
                or last_leg.get("arr")
                or item.get("arrival")
                or item.get("arr")
                or ""
            )

            if isinstance(flights_list, list) and flights_list:
                stops_count = max(len(flights_list) - 1, 0)
            else:
                stops_count = item.get("stops", 0) or item.get("stop_count", 0) or 0

            duration_mins = (
                item.get("total_duration")
                or item.get("duration")
                or item.get("durationInMinutes")
                or 0
            )

            if not isinstance(duration_mins, int):
                try:
                    duration_mins = int(duration_mins)
                except Exception:
                    duration_mins = 0

            price = (
                item.get("price")
                or item.get("amount")
                or item.get("raw_price")
                or 0
            )

            if isinstance(price, dict):
                price = price.get("raw") or price.get("value") or 0

            flights.append({
                "airline": airline_name,
                "dep": dep,
                "arr": arr,
                "stops": stops_count,
                "duration": duration_mins,
                "durationText": mins_to_text(duration_mins),
                "price": price,
                "formattedPrice": f"USD {price}" if price else "",
                "raw": item,
            })

        return {
            "flights": flights,
            "source": "google_flights",
            "provider_name": "Google Flights",
            "airport_lookup": {
                "origin": departure_id,
                "destination": arrival_id,
            },
        }


@app.get("/api/hotels")
async def search_hotels(
    city: str = Query(...),
    checkin: str = Query(...),
    checkout: str = Query(...),
    adults: int = Query(1),
    room_qty: int = Query(1),
):
    if not city or not city.strip():
        raise HTTPException(status_code=400, detail="City is required")
    if not checkin or not checkout:
        raise HTTPException(status_code=400, detail="Check-in and checkout dates are required")
    if adults < 1:
        raise HTTPException(status_code=400, detail="At least 1 adult is required")
    if not RAPIDAPI_KEY:
        raise HTTPException(status_code=500, detail="Missing RAPIDAPI_KEY")

    async with httpx.AsyncClient(timeout=40) as client:
        destination_url = f"https://{BOOKING_HOST}/api/v1/hotels/searchDestination"
        destination_params = {"query": city}
        debug_log("HOTEL DESTINATION SEARCH", destination_url, destination_params)

        dest_res = await client.get(
            destination_url,
            params=destination_params,
            headers=rapid_headers(BOOKING_HOST),
        )

        if dest_res.status_code != 200:
            raise HTTPException(
                status_code=500,
                detail=f"Destination search failed: {dest_res.text}",
            )

        dest_json = dest_res.json()
        destinations = dest_json.get("data", [])
        if not destinations:
            raise HTTPException(status_code=404, detail="No hotel destination found")

        first_dest = destinations[0]
        dest_id = first_dest.get("dest_id")
        search_type = first_dest.get("search_type")

        if not dest_id or not search_type:
            raise HTTPException(status_code=500, detail="dest_id/search_type missing")

        hotel_url = f"https://{BOOKING_HOST}/api/v1/hotels/searchHotels"
        hotel_params = {
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
        }
        debug_log("HOTEL SEARCH", hotel_url, hotel_params)

        hotel_res = await client.get(
            hotel_url,
            params=hotel_params,
            headers=rapid_headers(BOOKING_HOST),
        )

        if hotel_res.status_code != 200:
            raise HTTPException(
                status_code=500,
                detail=f"Hotel search failed: {hotel_res.text}",
            )

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
                "formattedPrice": (
                    f"{gross.get('currency')} {gross.get('value')}"
                    if gross.get("currency") and gross.get("value")
                    else ""
                ),
                "currency": gross.get("currency", "INR"),
                "area": prop.get("wishlistName", city),
                "amenities": [],
                "raw": item,
            })

        return {"hotels": hotels}


@app.get("/api/climate")
async def climate(city: str = Query(...), lang: str = Query("EN")):
    if not city or not city.strip():
        raise HTTPException(status_code=400, detail="City is required")
    if not RAPIDAPI_KEY:
        raise HTTPException(status_code=500, detail="Missing RAPIDAPI_KEY")

    async with httpx.AsyncClient(
        timeout=30,
        headers={"User-Agent": "travel-agent-orchestrator/1.0"}
    ) as client:
        geo_url = "https://nominatim.openstreetmap.org/search"
        geo_params = {
            "q": city,
            "format": "jsonv2",
            "limit": 1,
        }

        print("\n===== API DEBUG =====")
        print("LABEL: WEATHER GEOCODING")
        print("URL:", geo_url)
        print("PARAMS:", geo_params)
        print("=====================\n")

        geo_res = await client.get(geo_url, params=geo_params)
        if geo_res.status_code != 200:
            raise HTTPException(
                status_code=500,
                detail=f"Weather geocoding failed: {geo_res.text}",
            )

        geo_data = geo_res.json()
        if not geo_data:
            raise HTTPException(
                status_code=404,
                detail=f"Could not find coordinates for city: {city}",
            )

        lat = geo_data[0].get("lat")
        lon = geo_data[0].get("lon")

        if lat is None or lon is None:
            raise HTTPException(
                status_code=500,
                detail=f"Coordinates missing for city: {city}",
            )

        weather_url = f"https://{WEATHER_HOST}/fivedaysforcast"
        weather_params = {
            "latitude": lat,
            "longitude": lon,
            "lang": lang,
        }

        print("\n===== API DEBUG =====")
        print("LABEL: WEATHER FORECAST")
        print("URL:", weather_url)
        print("PARAMS:", weather_params)
        print("=====================\n")

        weather_res = await client.get(
            weather_url,
            params=weather_params,
            headers=rapid_headers(WEATHER_HOST),
        )

        if weather_res.status_code != 200:
            raise HTTPException(
                status_code=500,
                detail=f"Weather lookup failed: {weather_res.text}",
            )

        data = weather_res.json()

        forecast_list = data.get("list", []) if isinstance(data, dict) else []
        first_item = forecast_list[0] if forecast_list else {}

        main = first_item.get("main", {})
        weather_list = first_item.get("weather", [])
        wind = first_item.get("wind", {})
        weather_text = weather_list[0].get("description", "") if weather_list else ""

        rain_value = "N/A"
        rain_obj = first_item.get("rain", {})
        if isinstance(rain_obj, dict):
            rain_value = rain_obj.get("3h", "N/A")

        return {
            "temp": f"{round(main.get('temp', 0))}°C" if main.get("temp") is not None else "N/A",
            "humidity": f"{main.get('humidity', 0)}%" if main.get("humidity") is not None else "N/A",
            "condition": weather_text or "N/A",
            "windSpeed": wind.get("speed", 0),
            "rain": rain_value,
            "advisory": "Carry umbrella" if "rain" in weather_text.lower() else "Weather looks manageable",
            "raw": data,
        }
