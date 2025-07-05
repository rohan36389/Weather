import React, { useState } from 'react';
import './App.css';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { translations } from './translations';
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
  0: { level: 'good', color: '#00E400', description: 'Air quality is excellent. Perfect for outdoor activities.' },
  51: { level: 'moderate', color: '#FFFF00', description: 'Air quality is acceptable. Sensitive individuals should limit outdoor activities.' },
  101: { level: 'unhealthySensitive', color: '#FF7E00', description: 'Sensitive groups should avoid outdoor activities.' },
  151: { level: 'unhealthy', color: '#FF0000', description: 'Everyone should limit outdoor activities.' },
  201: { level: 'veryUnhealthy', color: '#8F3F97', description: 'Avoid outdoor activities. Health alert for everyone.' },
  301: { level: 'hazardous', color: '#7E0023', description: 'Emergency conditions. Stay indoors.' }
};

const POLLUTANTS = {
  'pm2_5': { name: 'PM2.5', unit: 'μg/m³', key: 'pm25' },
  'pm10': { name: 'PM10', unit: 'μg/m³', key: 'pm10' },
  'o3': { name: 'O₃', unit: 'μg/m³', key: 'o3' },
  'no2': { name: 'NO₂', unit: 'μg/m³', key: 'no2' },
  'so2': { name: 'SO₂', unit: 'μg/m³', key: 'so2' },
  'co': { name: 'CO', unit: 'μg/m³', key: 'co' }
};

const WEATHER_ICONS = {
  '01d': '☀️', '01n': '🌙', '02d': '⛅', '02n': '☁️',
  '03d': '☁️', '03n': '☁️', '04d': '☁️', '04n': '☁️',
  '09d': '🌧️', '09n': '🌧️', '10d': '🌦️', '10n': '🌧️',
  '11d': '⛈️', '11n': '⛈️', '13d': '❄️', '13n': '❄️',
  '50d': '🌫️', '50n': '🌫️'
};

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' }
];

function App() {
  const [city, setCity] = useState('');
  const [language, setLanguage] = useState('en');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [airQuality, setAirQuality] = useState(null);
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]); // Default to India center

  const API_KEY = 'd8614ec2c0bd70cddbb2b95a86e0b530'; // OpenWeatherMap API key
  const t = translations[language];

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

  const getWeatherAndAirQuality = async (lat, lon, cityName) => {
    setLoading(true);
    setError(null);
    
    try {
      // Get current air pollution data
      const currentAirUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
      const currentAirRes = await fetch(currentAirUrl);
      const currentAirData = await currentAirRes.json();

      // Get current weather data
      const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
      const currentWeatherRes = await fetch(currentWeatherUrl);
      const currentWeatherData = await currentWeatherRes.json();

      // Get forecast air pollution data
      const forecastAirUrl = `https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
      const forecastAirRes = await fetch(forecastAirUrl);
      const forecastAirData = await forecastAirRes.json();

      // Get 5-day weather forecast
      const forecastWeatherUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
      const forecastWeatherRes = await fetch(forecastWeatherUrl);
      const forecastWeatherData = await forecastWeatherRes.json();

      if (currentAirData.list && currentAirData.list.length > 0 && currentWeatherData) {
        const currentAir = currentAirData.list[0];
        const pollutants = currentAir.components;
        const aqi = calculateAQI(pollutants);
        const aqiLevel = getAQILevel(aqi);

        setAirQuality({
          cityName,
          aqi,
          aqiLevel,
          pollutants,
          coords: { lat, lon }
        });

        setWeather({
          temperature: Math.round(currentWeatherData.main.temp),
          feelsLike: Math.round(currentWeatherData.main.feels_like),
          humidity: currentWeatherData.main.humidity,
          pressure: currentWeatherData.main.pressure,
          windSpeed: currentWeatherData.wind?.speed || 0,
          visibility: currentWeatherData.visibility ? Math.round(currentWeatherData.visibility / 1000) : null,
          description: currentWeatherData.weather[0].description,
          icon: WEATHER_ICONS[currentWeatherData.weather[0].icon] || '🌤️',
          clouds: currentWeatherData.clouds.all
        });

        // Process forecast data
        if (forecastAirData.list && forecastWeatherData.list) {
          const dailyForecast = [];
          const processedDates = new Set();

          for (let i = 0; i < forecastAirData.list.length; i += 8) { // Get one reading per day
            if (dailyForecast.length >= 5) break;

            const airItem = forecastAirData.list[i];
            const date = new Date(airItem.dt * 1000);
            const dateKey = date.toDateString();

            if (!processedDates.has(dateKey)) {
              processedDates.add(dateKey);

              // Find corresponding weather data
              const weatherItem = forecastWeatherData.list.find(w => {
                const wDate = new Date(w.dt * 1000);
                return wDate.toDateString() === dateKey;
              }) || forecastWeatherData.list[Math.floor(i / 8) * 8] || forecastWeatherData.list[0];

              const forecastAqi = calculateAQI(airItem.components);
              const forecastLevel = getAQILevel(forecastAqi);
              
              dailyForecast.push({
                date: date.toLocaleDateString(language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : language === 'hi' ? 'hi-IN' : language === 'fr' ? 'fr-FR' : 'zh-CN', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                }),
                aqi: forecastAqi,
                level: t[forecastLevel.level],
                color: forecastLevel.color,
                pollutants: airItem.components,
                temperature: Math.round(weatherItem.main.temp),
                weather: weatherItem.weather[0].description,
                icon: WEATHER_ICONS[weatherItem.weather[0].icon] || '🌤️'
              });
            }
          }

          setForecast(dailyForecast);
        }

        setMapCenter([lat, lon]);
      }
    } catch (err) {
      setError(t.loadingError);
      console.error('Error fetching data:', err);
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
        setError(t.cityNotFound);
        return;
      }

      const { lat, lon } = geoData.coord;
      setCurrentLocation({ lat, lon, name: geoData.name });
      await getWeatherAndAirQuality(lat, lon, geoData.name);
    } catch (err) {
      setError(t.loadingError);
      console.error('Error searching city:', err);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ lat: latitude, lon: longitude, name: 'Current Location' });
          await getWeatherAndAirQuality(latitude, longitude, 'Current Location');
        },
        (error) => {
          setError(t.locationError);
          console.error('Geolocation error:', error);
        }
      );
    } else {
      setError(t.locationError);
    }
  };

  const getHealthAdvice = (aqi) => {
    if (aqi <= 50) return {
      outdoor: t.healthAdvice.outdoorGood,
      indoor: t.healthAdvice.indoorGood,
      vulnerable: t.healthAdvice.vulnerableGood
    };
    if (aqi <= 100) return {
      outdoor: t.healthAdvice.outdoorModerate,
      indoor: t.healthAdvice.indoorGood,
      vulnerable: t.healthAdvice.vulnerablePoor
    };
    if (aqi <= 150) return {
      outdoor: t.healthAdvice.outdoorUnhealthy,
      indoor: t.healthAdvice.indoorPoor,
      vulnerable: t.healthAdvice.vulnerablePoor
    };
    return {
      outdoor: t.healthAdvice.outdoorVeryUnhealthy,
      indoor: t.healthAdvice.indoorPoor,
      vulnerable: t.healthAdvice.vulnerablePoor
    };
  };

  const aqiChartData = airQuality ? {
    labels: ['AQI'],
    datasets: [{
      label: t.aqiTrend,
      data: [airQuality.aqi],
      backgroundColor: [airQuality.aqiLevel.color],
      borderColor: [airQuality.aqiLevel.color],
      borderWidth: 2
    }]
  } : null;

  const pollutantChartData = airQuality ? {
    labels: Object.keys(POLLUTANTS).map(key => POLLUTANTS[key].name),
    datasets: [{
      label: t.pollutantBreakdown,
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
      label: t.aqiTrend,
      data: forecast.map(day => day.aqi),
      fill: false,
      borderColor: '#4BC0C0',
      backgroundColor: '#4BC0C0',
      tension: 0.3,
      pointBackgroundColor: forecast.map(day => day.color),
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 6,
      yAxisID: 'y'
    }, {
      label: t.weatherTrend,
      data: forecast.map(day => day.temperature),
      fill: false,
      borderColor: '#FF6384',
      backgroundColor: '#FF6384',
      tension: 0.3,
      pointBackgroundColor: '#FF6384',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 6,
      yAxisID: 'y1'
    }]
  } : null;

  const forecastChartOptions = {
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'AQI'
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: `${t.temperature} (°C)`
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  const healthAdvice = airQuality ? getHealthAdvice(airQuality.aqi) : null;

  return (
    <div className="App">
      {/* Language Selector */}
      <div className="language-selector">
        <select 
          value={language} 
          onChange={(e) => setLanguage(e.target.value)}
          className="language-dropdown"
        >
          {LANGUAGES.map(lang => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>
      </div>

      {/* Hero Section */}
      <div className="hero-section">
        <img 
          src="https://images.pexels.com/photos/32833331/pexels-photo-32833331.jpeg" 
          alt="Clean Air Mountains" 
          className="hero-image" 
        />
        <div className="hero-content">
          <h1 className="hero-title">🌍 {t.title}</h1>
          <p className="hero-subtitle">{t.subtitle}</p>
          <div className="search-container">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="city-input"
              onKeyPress={(e) => e.key === 'Enter' && searchCity()}
            />
            <button onClick={searchCity} className="search-btn" disabled={loading}>
              {loading ? '⏳' : t.searchButton}
            </button>
            <button onClick={getCurrentLocation} className="location-btn" disabled={loading}>
              {t.useLocationButton}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      {airQuality && weather && (
        <div className="main-content">
          {/* Current Air Quality and Weather */}
          <div className="current-data-section">
            <div className="current-aqi-section">
              <h2>{t.currentAirQuality} - {airQuality.cityName}</h2>
              <div className="aqi-display">
                <div className="aqi-circle" style={{ backgroundColor: airQuality.aqiLevel.color }}>
                  <span className="aqi-number">{airQuality.aqi}</span>
                  <span className="aqi-label">AQI</span>
                </div>
                <div className="aqi-info">
                  <h3>{t[airQuality.aqiLevel.level]}</h3>
                  <p>{airQuality.aqiLevel.description}</p>
                </div>
              </div>
            </div>

            <div className="current-weather-section">
              <h2>{t.currentWeather}</h2>
              <div className="weather-display">
                <div className="weather-icon">
                  <span className="weather-emoji">{weather.icon}</span>
                  <span className="weather-temp">{weather.temperature}°C</span>
                </div>
                <div className="weather-info">
                  <h3>{weather.description}</h3>
                  <p>{t.feelsLike}: {weather.feelsLike}°C</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pollutant Details */}
          <div className="pollutants-section">
            <h3>{t.pollutantBreakdown}</h3>
            <div className="pollutants-grid">
              {Object.entries(POLLUTANTS).map(([key, pollutant]) => (
                <div key={key} className="pollutant-card">
                  <h4>{pollutant.name}</h4>
                  <p className="pollutant-value">
                    {airQuality.pollutants[key] || 0} {pollutant.unit}
                  </p>
                  <p className="pollutant-desc">{t.pollutants[pollutant.key]}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Weather Details */}
          <div className="weather-details-section">
            <h3>{t.weatherDetails}</h3>
            <div className="weather-grid">
              <div className="weather-card">
                <h4>🌡️ {t.temperature}</h4>
                <p className="weather-value">{weather.temperature}°C</p>
              </div>
              <div className="weather-card">
                <h4>💧 {t.humidity}</h4>
                <p className="weather-value">{weather.humidity}%</p>
              </div>
              <div className="weather-card">
                <h4>💨 {t.windSpeed}</h4>
                <p className="weather-value">{weather.windSpeed} m/s</p>
              </div>
              <div className="weather-card">
                <h4>📊 {t.pressure}</h4>
                <p className="weather-value">{weather.pressure} hPa</p>
              </div>
              {weather.visibility && (
                <div className="weather-card">
                  <h4>👁️ {t.visibility}</h4>
                  <p className="weather-value">{weather.visibility} km</p>
                </div>
              )}
              <div className="weather-card">
                <h4>☁️ Clouds</h4>
                <p className="weather-value">{weather.clouds}%</p>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="charts-section">
            <div className="chart-container">
              <h3>{t.currentAirQuality}</h3>
              {aqiChartData && <Bar data={aqiChartData} options={{ responsive: true }} />}
            </div>
            
            <div className="chart-container">
              <h3>{t.pollutantBreakdown}</h3>
              {pollutantChartData && <Doughnut data={pollutantChartData} options={{ responsive: true }} />}
            </div>
          </div>

          {/* Forecast Section */}
          {forecast.length > 0 && (
            <div className="forecast-section">
              <h3>{t.forecastTitle}</h3>
              <div className="forecast-grid">
                {forecast.map((day, index) => (
                  <div key={index} className="forecast-card">
                    <h4>{day.date}</h4>
                    <div className="forecast-weather">
                      <span className="forecast-icon">{day.icon}</span>
                      <span className="forecast-temp">{day.temperature}°C</span>
                    </div>
                    <div className="forecast-aqi" style={{ backgroundColor: day.color }}>
                      AQI {day.aqi}
                    </div>
                    <p>{day.level}</p>
                  </div>
                ))}
              </div>
              
              <div className="forecast-chart">
                <h3>{t.aqiTrend} & {t.weatherTrend}</h3>
                {forecastChartData && <Line data={forecastChartData} options={forecastChartOptions} />}
              </div>
            </div>
          )}

          {/* Map Section */}
          <div className="map-section">
            <h3>{t.locationMap}</h3>
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
                      AQI: {airQuality.aqi} ({t[airQuality.aqiLevel.level]})<br />
                      {t.temperature}: {weather.temperature}°C
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
          {healthAdvice && (
            <div className="health-section">
              <h3>{t.healthRecommendations}</h3>
              <div className="health-advice">
                <div className="advice-card">
                  <h4>{t.outdoorActivities}</h4>
                  <p>{healthAdvice.outdoor}</p>
                </div>
                <div className="advice-card">
                  <h4>{t.indoorPrecautions}</h4>
                  <p>{healthAdvice.indoor}</p>
                </div>
                <div className="advice-card">
                  <h4>{t.vulnerableGroups}</h4>
                  <p>{healthAdvice.vulnerable}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <p>{t.footerText}</p>
        <p>{t.dataSource}</p>
      </footer>
    </div>
  );
}

export default App;