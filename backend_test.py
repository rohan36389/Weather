import requests
import sys
import time
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class AirQualityAPITester:
    def __init__(self, base_url=None):
        # Use environment variable if available, otherwise use default
        self.base_url = base_url or os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001/api")
        self.tests_run = 0
        self.tests_passed = 0
        print(f"Using API endpoint: {self.base_url}")

    def run_test(self, name, endpoint, expected_status, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            response = requests.get(url, params=params)
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                if response.status_code == 200:
                    return success, response.json()
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                if response.text:
                    print(f"Response: {response.text}")
            
            return success, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test the health check endpoint"""
        success, response = self.run_test(
            "Health Check",
            "health",
            200
        )
        return success

    def test_air_quality_by_city(self, city):
        """Test getting air quality by city name"""
        success, response = self.run_test(
            f"Air Quality for {city}",
            "air-quality",
            200,
            params={"city": city}
        )
        
        if success:
            print(f"City: {response.get('city')}")
            if 'current' in response and 'list' in response['current'] and len(response['current']['list']) > 0:
                components = response['current']['list'][0]['components']
                print(f"Pollutants: PM2.5={components.get('pm2_5')}μg/m³, PM10={components.get('pm10')}μg/m³")
                print(f"AQI: {response['current']['list'][0].get('main', {}).get('aqi')}")
                
                # Check if forecast data is available
                if 'forecast' in response and 'list' in response['forecast'] and len(response['forecast']['list']) > 0:
                    print(f"Forecast data available: {len(response['forecast']['list'])} entries")
                else:
                    print("⚠️ No forecast data available")
                
                return True
            else:
                print("❌ Invalid response format")
                return False
        return False

    def test_air_quality_by_coordinates(self, lat, lon):
        """Test getting air quality by coordinates"""
        success, response = self.run_test(
            f"Air Quality for coordinates ({lat}, {lon})",
            "air-quality",
            200,
            params={"lat": lat, "lon": lon}
        )
        
        if success:
            print(f"Location: {response.get('city')}")
            if 'current' in response and 'list' in response['current'] and len(response['current']['list']) > 0:
                components = response['current']['list'][0]['components']
                print(f"Pollutants: PM2.5={components.get('pm2_5')}μg/m³, PM10={components.get('pm10')}μg/m³")
                print(f"AQI: {response['current']['list'][0].get('main', {}).get('aqi')}")
                
                # Check if forecast data is available
                if 'forecast' in response and 'list' in response['forecast'] and len(response['forecast']['list']) > 0:
                    print(f"Forecast data available: {len(response['forecast']['list'])} entries")
                else:
                    print("⚠️ No forecast data available")
                
                return True
            else:
                print("❌ Invalid response format")
                return False
        return False

    def test_invalid_city(self):
        """Test with an invalid city name"""
        success, _ = self.run_test(
            "Invalid City",
            "air-quality",
            404,
            params={"city": "ThisCityDoesNotExist12345"}
        )
        return success

    def test_missing_parameters(self):
        """Test with missing parameters"""
        success, _ = self.run_test(
            "Missing Parameters",
            "air-quality",
            400,
            params={}
        )
        return success

def main():
    # Get backend URL from environment variable
    backend_url = os.environ.get("REACT_APP_BACKEND_URL")
    
    # Setup tester with the correct backend URL
    tester = AirQualityAPITester(backend_url)
    
    # Run tests
    print("\n===== Air Quality API Tests =====\n")
    
    # Test health check
    tester.test_health_check()
    
    # Test with different cities as specified in the requirements
    cities = ["Tokyo", "London", "New York", "Paris", "Mumbai", "Cairo", "Stockholm", "Austin", "Sedona", "Boulder"]
    for city in cities:
        tester.test_air_quality_by_city(city)
        time.sleep(1)  # Avoid rate limiting
    
    # Test with coordinates
    tester.test_air_quality_by_coordinates(40.7128, -74.0060)  # New York
    
    # Test error cases
    tester.test_invalid_city()
    tester.test_missing_parameters()
    
    # Print results
    print(f"\n📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())