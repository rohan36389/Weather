from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = 'd8614ec2c0bd70cddbb2b95a86e0b530'  # OpenWeatherMap API key

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

@app.get("/api/air-quality")
async def get_air_quality(city: str = None, lat: float = None, lon: float = None):
    if not city and (lat is None or lon is None):
        raise HTTPException(status_code=400, detail="Either city name or coordinates (lat, lon) must be provided")
    
    # If city is provided, get coordinates
    if city:
        try:
            geo_url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={API_KEY}"
            geo_res = requests.get(geo_url)
            geo_data = geo_res.json()
            
            if geo_res.status_code != 200:
                raise HTTPException(status_code=404, detail=f"City not found: {city}")
            
            lat = geo_data["coord"]["lat"]
            lon = geo_data["coord"]["lon"]
            city_name = geo_data["name"]
        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            raise HTTPException(status_code=404, detail=f"City not found: {city}")
    else:
        city_name = "Custom Location"
    
    try:
        # Get current air pollution data
        current_url = f"https://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lon}&appid={API_KEY}"
        current_res = requests.get(current_url)
        
        if current_res.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch air quality data")
        
        current_data = current_res.json()
        
        # Get forecast air pollution data
        forecast_url = f"https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat={lat}&lon={lon}&appid={API_KEY}"
        forecast_res = requests.get(forecast_url)
        
        if forecast_res.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch forecast data")
        
        forecast_data = forecast_res.json()
        
        return {
            "city": city_name,
            "coordinates": {"lat": lat, "lon": lon},
            "current": current_data,
            "forecast": forecast_data
        }
    
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)