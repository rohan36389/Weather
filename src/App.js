import React, { useState } from 'react';
import './App.css';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

const languageOptions = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'te', label: 'Telugu' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
];

const weatherCodeToEmoji = {
  1000: "☀️",
  1001: "☁️",
  1100: "🌤️",
  1101: "⛅",
  1102: "🌥️",
  2000: "🌫️",
  4000: "🌧️",
  5000: "❄️",
};

function App() {
  const [city, setCity] = useState('');
  const [lang, setLang] = useState('en');
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);

  const apiKey = 'A7XTf01UCYLRDQJKjgr50ALKTLlnQzPu'; // Tomorrow.io API Key

  const getWeather = async () => {
    if (!city) return;

    try {
      // Step 1: Get city coordinates from OpenWeatherMap (or use geocoding API if needed)
      const geoUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=d8614ec2c0bd70cddbb2b95a86e0b530`;
      const geoRes = await fetch(geoUrl);
      const geoData = await geoRes.json();

      if (geoData.cod !== 200) {
        alert('City not found!');
        return;
      }

      const { lat, lon } = geoData.coord;

      // Step 2: Get forecast from Tomorrow.io
      const forecastUrl = `https://api.tomorrow.io/v4/weather/forecast?location=${lat},${lon}&apikey=${apiKey}`;
      const forecastRes = await fetch(forecastUrl);
      const forecastData = await forecastRes.json();

      if (!forecastData?.timelines?.daily) {
        alert('Could not fetch forecast. Try again later.');
        return;
      }

      const daily = forecastData.timelines.daily.slice(0, 7).map((day) => ({
        date: new Date(day.time).toLocaleDateString('en-IN', {
          weekday: 'short',
        }),
        temp: day.values.temperatureMax,
        min: day.values.temperatureMin,
        desc: `Min ${day.values.temperatureMin}°C / Max ${day.values.temperatureMax}°C`,
        icon: weatherCodeToEmoji[day.values.weatherCodeMax] || '❓',
      }));

      setWeather({
        cityName: geoData.name,
        current: `${daily[0].desc} ${daily[0].icon}`,
        temp: daily[0].temp,
      });

      setForecast(daily);
    } catch (error) {
      alert('Failed to fetch weather data.');
      console.error(error);
    }
  };

  const forecastChart = {
    labels: forecast.map((d) => d.date),
    datasets: [
      {
        label: 'Temperature (°C)',
        data: forecast.map((d) => d.temp),
        fill: false,
        borderColor: '#4caf50',
        tension: 0.3,
        pointBackgroundColor: 'orange',
      },
    ],
  };

  return (
    <div className="App">
      <h1>🌦️ Weather Forecast</h1>

      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value.trim())}
          placeholder="Enter city"
        />
        <select value={lang} onChange={(e) => setLang(e.target.value)}>
          {languageOptions.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        <button onClick={getWeather}>Get Weather</button>
      </div>

      {weather && (
        <div id="weather-info">
          <h2>{weather.cityName}</h2>
          <p>
            <strong>{weather.current}</strong>
          </p>
          <p>Temperature: {weather.temp}°C</p>
        </div>
      )}

      {forecast.length > 0 && (
        <>
          <h3>7-Day Forecast</h3>
          <div className="forecast">
            {forecast.map((day, i) => (
              <div key={i} className="day">
                <p>{day.date}</p>
                <p>{day.icon}</p>
                <p>{day.temp}°C</p>
              </div>
            ))}
          </div>

          <div style={{ width: '90%', maxWidth: '600px', margin: 'auto' }}>
            <Line data={forecastChart} />
          </div>
        </>
      )}
    </div>
  );
}

export default App;
