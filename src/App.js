import React, { useState, useEffect } from 'react';
import './App.css';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
} from 'chart.js';

ChartJS.register(
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale
);

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const AQI_LEVELS = {
  0: { level: 'Good', color: '#00E400', description: 'Air quality is excellent. Perfect for outdoor activities.' },
  51: { level: 'Moderate', color: '#FFFF00', description: 'Air quality is acceptable. Sensitive individuals should limit outdoor activities.' },
  101: { level: 'Unhealthy for Sensitive Groups', color: '#FF7E00', description: 'Sensitive groups should avoid outdoor activities.' },
  151: { level: 'Unhealthy', color: '#FF0000', description: 'Everyone should limit outdoor activities.' },
  201: { level: 'Very Unhealthy', color: '#8F3F97', description: 'Avoid outdoor activities. Health alert for everyone.' },
  301: { level: 'Hazardous', color: '#7E0023', description: 'Emergency conditions. Stay indoors.' }
};

const POLLUTANTS = {
  'pm2_5': { name: 'PM2.5', unit: 'μg/m³', description: 'Fine particulate matter' },
  'pm10': { name: 'PM10', unit: 'μg/m³', description: 'Coarse particulate matter' },
  'o3': { name: 'O₃', unit: 'μg/m³', description: 'Ozone' },
  'no2': { name: 'NO₂', unit: 'μg/m³', description: 'Nitrogen dioxide' },
  'so2': { name: 'SO₂', unit: 'μg/m³', description: 'Sulfur dioxide' },
  'co': { name: 'CO', unit: 'μg/m³', description: 'Carbon monoxide' }
};

function App() {
  const [city, setCity] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [airQuality, setAirQuality] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]); // Default to India center

  const API_KEY = 'd8614ec2c0bd70cddbb2b95a86e0b530'; // OpenWeatherMap API key

  const getAQILevel = (aqi) => {
    if (aqi <= 50) return AQI_LEVELS[0];
    if (aqi <= 100) return AQI_LEVELS[51];
    if (aqi <= 150) return AQI_LEVELS[101];
    if (aqi <= 200) return AQI_LEVELS[151];
    if (aqi <= 300) return AQI_LEVELS[201];
    return AQI_LEVELS[301];
  };

  const calculateAQI = (pollutants) => {
    // Simplified AQI calculation based on PM2.5 (main indicator)
    const pm25 = pollutants.pm2_5;
    if (pm25 <= 12) return Math.round((50 / 12) * pm25);
    if (pm25 <= 35.4) return Math.round(((100 - 51) / (35.4 - 12)) * (pm25 - 12) + 51);
    if (pm25 <= 55.4) return Math.round(((150 - 101) / (55.4 - 35.4)) * (pm25 - 35.4) + 101);
    if (pm25 <= 150.4) return Math.round(((200 - 151) / (150.4 - 55.4)) * (pm25 - 55.4) + 151);
    if (pm25 <= 250.4) return Math.round(((300 - 201) / (250.4 - 150.4)) * (pm25 - 150.4) + 201);
    return Math.round(((400 - 301) / (350.4 - 250.4)) * (pm25 - 250.4) + 301);
  };

  const getAirQualityData = async (lat, lon, cityName) => {
    setLoading(true);
    setError(null);
    
    try {
      // Get current air pollution data
      const currentUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
      const currentRes = await fetch(currentUrl);
      const currentData = await currentRes.json();

      // Get forecast air pollution data
      const forecastUrl = `https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
      const forecastRes = await fetch(forecastUrl);
      const forecastData = await forecastRes.json();

      if (currentData.list && currentData.list.length > 0) {
        const current = currentData.list[0];
        const pollutants = current.components;
        const aqi = calculateAQI(pollutants);
        const aqiLevel = getAQILevel(aqi);

        setAirQuality({
          cityName,
          aqi,
          aqiLevel,
          pollutants,
          coords: { lat, lon }
        });

        // Process forecast data
        if (forecastData.list) {
          const dailyForecast = forecastData.list
            .filter((_, index) => index % 8 === 0) // Get one reading per day
            .slice(0, 5)
            .map(item => {
              const date = new Date(item.dt * 1000);
              const forecastAqi = calculateAQI(item.components);
              const forecastLevel = getAQILevel(forecastAqi);
              
              return {
                date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                aqi: forecastAqi,
                level: forecastLevel.level,
                color: forecastLevel.color,
                pollutants: item.components
              };
            });

          setForecast(dailyForecast);
        }

        setMapCenter([lat, lon]);
      }
    } catch (err) {
      setError('Failed to fetch air quality data. Please try again.');
      console.error('Error fetching air quality data:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchCity = async () => {
    if (!city.trim()) return;

    try {
      const geoUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}`;
      const geoRes = await fetch(geoUrl);
      const geoData = await geoRes.json();

      if (geoData.cod !== 200) {
        setError('City not found. Please check the spelling and try again.');
        return;
      }

      const { lat, lon } = geoData.coord;
      setCurrentLocation({ lat, lon, name: geoData.name });
      await getAirQualityData(lat, lon, geoData.name);
    } catch (err) {
      setError('Failed to search city. Please try again.');
      console.error('Error searching city:', err);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ lat: latitude, lon: longitude, name: 'Current Location' });
          await getAirQualityData(latitude, longitude, 'Current Location');
        },
        (error) => {
          setError('Unable to retrieve your location. Please search for a city instead.');
          console.error('Geolocation error:', error);
        }
      );
    } else {
      setError('Geolocation is not supported by this browser.');
    }
  };

  const aqiChartData = airQuality ? {
    labels: ['Current AQI'],
    datasets: [{
      label: 'Air Quality Index',
      data: [airQuality.aqi],
      backgroundColor: [airQuality.aqiLevel.color],
      borderColor: [airQuality.aqiLevel.color],
      borderWidth: 2
    }]
  } : null;

  const pollutantChartData = airQuality ? {
    labels: Object.keys(POLLUTANTS).map(key => POLLUTANTS[key].name),
    datasets: [{
      label: 'Pollutant Levels (μg/m³)',
      data: Object.keys(POLLUTANTS).map(key => airQuality.pollutants[key] || 0),
      backgroundColor: [
        '#FF6384',
        '#36A2EB',
        '#FFCE56',
        '#4BC0C0',
        '#9966FF',
        '#FF9F40'
      ],
      borderWidth: 1
    }]
  } : null;

  const forecastChartData = forecast.length > 0 ? {
    labels: forecast.map(day => day.date),
    datasets: [{
      label: 'AQI Forecast',
      data: forecast.map(day => day.aqi),
      fill: false,
      borderColor: '#4BC0C0',
      backgroundColor: '#4BC0C0',
      tension: 0.3,
      pointBackgroundColor: forecast.map(day => day.color),
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 6
    }]
  } : null;

  return (
    <div className="App">
      {/* Hero Section */}
      <div className="hero-section">
        <img 
          src="https://images.pexels.com/photos/32833331/pexels-photo-32833331.jpeg" 
          alt="Clean Air Mountains" 
          className="hero-image" 
        />
        <div className="hero-content">
          <h1 className="hero-title">🌍 Air Quality Visualizer</h1>
          <p className="hero-subtitle">Real-time air quality monitoring and forecasts for your location</p>
          <div className="search-container">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Enter city name..."
              className="city-input"
              onKeyPress={(e) => e.key === 'Enter' && searchCity()}
            />
            <button onClick={searchCity} className="search-btn" disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
            <button onClick={getCurrentLocation} className="location-btn" disabled={loading}>
              📍 Use My Location
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      {airQuality && (
        <div className="main-content">
          {/* Current Air Quality */}
          <div className="current-aqi-section">
            <h2>Current Air Quality - {airQuality.cityName}</h2>
            <div className="aqi-display">
              <div className="aqi-circle" style={{ backgroundColor: airQuality.aqiLevel.color }}>
                <span className="aqi-number">{airQuality.aqi}</span>
                <span className="aqi-label">AQI</span>
              </div>
              <div className="aqi-info">
                <h3>{airQuality.aqiLevel.level}</h3>
                <p>{airQuality.aqiLevel.description}</p>
              </div>
            </div>
          </div>

          {/* Pollutant Details */}
          <div className="pollutants-section">
            <h3>Pollutant Breakdown</h3>
            <div className="pollutants-grid">
              {Object.entries(POLLUTANTS).map(([key, pollutant]) => (
                <div key={key} className="pollutant-card">
                  <h4>{pollutant.name}</h4>
                  <p className="pollutant-value">
                    {airQuality.pollutants[key] || 0} {pollutant.unit}
                  </p>
                  <p className="pollutant-desc">{pollutant.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Charts Section */}
          <div className="charts-section">
            <div className="chart-container">
              <h3>Current AQI Level</h3>
              {aqiChartData && <Bar data={aqiChartData} options={{ responsive: true }} />}
            </div>
            
            <div className="chart-container">
              <h3>Pollutant Distribution</h3>
              {pollutantChartData && <Doughnut data={pollutantChartData} options={{ responsive: true }} />}
            </div>
          </div>

          {/* Forecast Section */}
          {forecast.length > 0 && (
            <div className="forecast-section">
              <h3>5-Day Air Quality Forecast</h3>
              <div className="forecast-grid">
                {forecast.map((day, index) => (
                  <div key={index} className="forecast-card">
                    <h4>{day.date}</h4>
                    <div className="forecast-aqi" style={{ backgroundColor: day.color }}>
                      {day.aqi}
                    </div>
                    <p>{day.level}</p>
                  </div>
                ))}
              </div>
              
              <div className="forecast-chart">
                <h3>AQI Trend</h3>
                {forecastChartData && <Line data={forecastChartData} options={{ responsive: true }} />}
              </div>
            </div>
          )}

          {/* Map Section */}
          <div className="map-section">
            <h3>Location Map</h3>
            <MapContainer center={mapCenter} zoom={10} style={{ height: '400px', width: '100%' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {currentLocation && (
                <Marker position={[currentLocation.lat, currentLocation.lon]}>
                  <Popup>
                    <div>
                      <strong>{currentLocation.name}</strong><br />
                      AQI: {airQuality.aqi} ({airQuality.aqiLevel.level})
                    </div>
                  </Popup>
                </Marker>
              )}
              {currentLocation && (
                <Circle
                  center={[currentLocation.lat, currentLocation.lon]}
                  radius={5000}
                  pathOptions={{
                    color: airQuality.aqiLevel.color,
                    fillColor: airQuality.aqiLevel.color,
                    fillOpacity: 0.2
                  }}
                />
              )}
            </MapContainer>
          </div>

          {/* Health Recommendations */}
          <div className="health-section">
            <h3>Health Recommendations</h3>
            <div className="health-advice">
              <div className="advice-card">
                <h4>🏃‍♂️ Outdoor Activities</h4>
                <p>
                  {airQuality.aqi <= 50 && "Perfect for outdoor activities and exercise."}
                  {airQuality.aqi > 50 && airQuality.aqi <= 100 && "Moderate air quality. Sensitive individuals should limit prolonged outdoor activities."}
                  {airQuality.aqi > 100 && airQuality.aqi <= 150 && "Unhealthy for sensitive groups. Consider indoor activities."}
                  {airQuality.aqi > 150 && "Avoid outdoor activities. Stay indoors when possible."}
                </p>
              </div>
              <div className="advice-card">
                <h4>🏠 Indoor Precautions</h4>
                <p>
                  {airQuality.aqi <= 100 && "Keep windows open for natural ventilation."}
                  {airQuality.aqi > 100 && "Keep windows closed. Use air purifiers if available."}
                </p>
              </div>
              <div className="advice-card">
                <h4>👥 Vulnerable Groups</h4>
                <p>
                  {airQuality.aqi <= 50 && "Safe for everyone including children and elderly."}
                  {airQuality.aqi > 50 && "Children, elderly, and people with respiratory conditions should take extra precautions."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <p>Air Quality Visualizer - Real-time environmental monitoring for healthier communities</p>
        <p>Data powered by OpenWeatherMap API</p>
      </footer>
    </div>
  );
}

export default App;