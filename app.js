let selectedDay = 0;
let activeFilter = "all";
let mapMarkers = [];
let userMarker = null;
let latestResults = [];

const beaches = [
  {
    name: "Għadira Bay",
    side: "North",
    area: "Mellieħa",
    type: "Sandy",
    lat: 35.9706,
    lng: 14.3578,
    exposedTo: ["NE", "E"]
  },
  {
    name: "Golden Bay",
    side: "West",
    area: "Mellieħa",
    type: "Sandy",
    lat: 35.9342,
    lng: 14.3441,
    exposedTo: ["NW", "W"]
  },
  {
    name: "Għajn Tuffieħa",
    side: "West",
    area: "Mġarr",
    type: "Sandy",
    lat: 35.9289,
    lng: 14.3444,
    exposedTo: ["NW", "W"]
  },
  {
    name: "Ġnejna Bay",
    side: "West",
    area: "Mġarr",
    type: "Sandy",
    lat: 35.9192,
    lng: 14.3405,
    exposedTo: ["W", "NW"]
  },
  {
    name: "Paradise Bay",
    side: "North",
    area: "Cirkewwa",
    type: "Sandy",
    lat: 35.9895,
    lng: 14.3291,
    exposedTo: ["N", "NE"]
  },
  {
    name: "Armier Bay",
    side: "North",
    area: "Mellieħa",
    type: "Sandy",
    lat: 35.9975,
    lng: 14.3674,
    exposedTo: ["NE", "E"]
  },
  {
    name: "Little Armier",
    side: "North",
    area: "Mellieħa",
    type: "Sandy",
    lat: 35.9947,
    lng: 14.3712,
    exposedTo: ["NE", "E"]
  },
  {
    name: "St George's Bay",
    side: "East",
    area: "St Julian's",
    type: "Sandy",
    lat: 35.9237,
    lng: 14.4916,
    exposedTo: ["E", "NE"]
  },
  {
    name: "Balluta Bay",
    side: "East",
    area: "Sliema",
    type: "Rocky",
    lat: 35.9149,
    lng: 14.4965,
    exposedTo: ["E"]
  },
  {
    name: "Exiles Beach",
    side: "East",
    area: "Sliema",
    type: "Rocky",
    lat: 35.9123,
    lng: 14.5002,
    exposedTo: ["E"]
  },
  {
    name: "Fond Għadir",
    side: "East",
    area: "Sliema",
    type: "Rocky",
    lat: 35.9095,
    lng: 14.5042,
    exposedTo: ["E"]
  },
  {
    name: "Buġibba Perched Beach",
    side: "North",
    area: "Buġibba",
    type: "Artificial",
    lat: 35.9519,
    lng: 14.4148,
    exposedTo: ["N", "NE"]
  },
  {
    name: "Qawra Point",
    side: "North",
    area: "Qawra",
    type: "Rocky",
    lat: 35.9572,
    lng: 14.4232,
    exposedTo: ["N", "NE"]
  },
  {
    name: "Pretty Bay",
    side: "South",
    area: "Birżebbuġa",
    type: "Sandy",
    lat: 35.8256,
    lng: 14.5269,
    exposedTo: ["SE", "S"]
  },
  {
    name: "St Peter's Pool",
    side: "South",
    area: "Marsaxlokk",
    type: "Rocky",
    lat: 35.8322,
    lng: 14.5624,
    exposedTo: ["S", "SE"]
  },
  {
    name: "Ramla Bay",
    side: "North",
    area: "Gozo",
    type: "Sandy",
    lat: 36.0612,
    lng: 14.2847,
    exposedTo: ["N", "NE"]
  },
  {
    name: "Xlendi Bay",
    side: "West",
    area: "Gozo",
    type: "Rocky",
    lat: 36.0283,
    lng: 14.2146,
    exposedTo: ["SW", "W"]
  },
  {
    name: "Hondoq ir-Rummien",
    side: "East",
    area: "Gozo",
    type: "Rocky",
    lat: 36.0182,
    lng: 14.3294,
    exposedTo: ["E", "SE"]
  },
  {
    name: "Blue Lagoon",
    side: "North",
    area: "Comino",
    type: "Rocky",
    lat: 36.0146,
    lng: 14.3317,
    exposedTo: ["N", "NE"]
  }
];

const map = L.map("map").setView([35.9375, 14.3754], 11);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

function getForecastHourIndex(day) {
  if (day === 0) {
    return new Date().getHours();
  }

  return day * 24 + 12;
}

function getSelectedDayLabel() {
  if (selectedDay === 0) return "today";
  if (selectedDay === 1) return "tomorrow";
  return "the day after tomorrow";
}

async function getWeatherForBeach(beach) {
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${beach.lat}&longitude=${beach.lng}` +
    `&hourly=wind_speed_10m,wind_direction_10m,precipitation_probability` +
    `&forecast_days=3`;

  const marineUrl =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${beach.lat}&longitude=${beach.lng}` +
    `&hourly=wave_height&forecast_days=3`;

  const weatherResponse = await fetch(weatherUrl);
  const marineResponse = await fetch(marineUrl);

  const weatherData = await weatherResponse.json();
  const marineData = await marineResponse.json();

  const hourIndex = getForecastHourIndex(selectedDay);

  return {
    windSpeed: weatherData.hourly.wind_speed_10m[hourIndex],
    windDirectionDegrees: weatherData.hourly.wind_direction_10m[hourIndex],
    rainChance: weatherData.hourly.precipitation_probability[hourIndex],
    waveHeight: marineData.hourly.wave_height[hourIndex]
  };
}

function degreesToCompass(degrees) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

function scoreBeach(beach, weather) {
  let score = 100;
  const windCompass = degreesToCompass(weather.windDirectionDegrees);
  const reasons = [];

  if (weather.waveHeight > 1) {
    score -= 50;
    reasons.push("High waves");
  } else if (weather.waveHeight > 0.5) {
    score -= 25;
    reasons.push("Moderate waves");
  }

  if (weather.windSpeed > 25) {
    score -= 20;
    reasons.push("Strong wind");
  }

  if (beach.exposedTo.includes(windCompass)) {
    score -= 30;
    reasons.push("Wind is blowing into this beach");
  }

  if (weather.rainChance > 50) {
    score -= 15;
    reasons.push("High chance of rain");
  }

  const jellyfishRisk = calculateJellyfishRisk(windCompass, beach);

  if (jellyfishRisk.level === "High") {
    score -= 25;
    reasons.push("High jellyfish risk");
  } else if (jellyfishRisk.level === "Medium") {
    score -= 10;
    reasons.push("Possible jellyfish risk");
  }

  let status = "Best";
  let className = "best";

  if (score < 60) {
    status = "Avoid";
    className = "avoid";
  } else if (score < 80) {
    status = "Good";
    className = "good";
  }

  return {
    score,
    status,
    className,
    windCompass,
    reasons,
    jellyfishRisk
  };
}

function calculateJellyfishRisk(windCompass, beach) {
  if (beach.exposedTo.includes(windCompass)) {
    return {
      level: "High",
      className: "jellyfish-high",
      text: "High risk"
    };
  }

  const nearbyRiskDirections = {
    N: ["NE", "NW"],
    NE: ["N", "E"],
    E: ["NE", "SE"],
    SE: ["E", "S"],
    S: ["SE", "SW"],
    SW: ["S", "W"],
    W: ["SW", "NW"],
    NW: ["W", "N"]
  };

  const nearbyDirections = nearbyRiskDirections[windCompass] || [];

  const hasNearbyExposure = beach.exposedTo.some(direction =>
    nearbyDirections.includes(direction)
  );

  if (hasNearbyExposure) {
    return {
      level: "Medium",
      className: "jellyfish-medium",
      text: "Medium risk"
    };
  }

  return {
    level: "Low",
    className: "jellyfish-low",
    text: "Low risk"
  };
}

function calculateBestSide(results) {
  const sideScores = {
    North: [],
    South: [],
    East: [],
    West: []
  };

  results.forEach(result => {
    sideScores[result.beach.side].push(result.rating.score);
  });

  let bestSide = "";
  let bestAverage = 0;

  for (const side in sideScores) {
    const scores = sideScores[side];

    if (scores.length === 0) continue;

    const average = scores.reduce((a, b) => a + b, 0) / scores.length;

    if (average > bestAverage) {
      bestAverage = average;
      bestSide = side;
    }
  }

  const banner = document.getElementById("best-side-banner");

  if (banner) {
    banner.innerHTML =
      `🌊 Best side of Malta ${getSelectedDayLabel()}: <strong>${bestSide}</strong> ` +
      `(${Math.round(bestAverage)}/100 average conditions)`;
  }
}

function clearMapMarkers() {
  mapMarkers.forEach(marker => {
    map.removeLayer(marker);
  });

  mapMarkers = [];
}

function filterResults(results) {
  if (activeFilter === "all") return results;

  if (activeFilter === "jellyfish-safe") {
    return results.filter(result => result.rating.jellyfishRisk.level === "Low");
  }

  return results.filter(result =>
    result.beach.type === activeFilter || result.beach.side === activeFilter
  );
}

function renderResults(results) {
  const beachList = document.getElementById("beach-list");
  beachList.innerHTML = "";

  clearMapMarkers();

  const filteredResults = filterResults(results);

  if (filteredResults.length === 0) {
    beachList.innerHTML = "No beaches match this filter.";
    return;
  }

  for (const result of filteredResults) {
    const { beach, weather, rating } = result;

    const reasonText =
      rating.reasons.length > 0
        ? rating.reasons.join(", ")
        : "Good swimming conditions";

    const card = document.createElement("div");
    card.className = `beach-card ${rating.className}-card`;

    card.innerHTML = `
      <h3>${beach.name}</h3>
      <span class="badge ${rating.className}">${rating.status}</span>

      <p><strong>Area:</strong> ${beach.area}</p>
      <p><strong>Side:</strong> ${beach.side}</p>
      <p><strong>Type:</strong> ${beach.type}</p>
      <p><strong>Score:</strong> ${rating.score}/100</p>

      <p><strong>Wind:</strong> ${rating.windCompass}, ${weather.windSpeed} km/h</p>
      <p><strong>Waves:</strong> ${weather.waveHeight} m</p>
      <p><strong>Rain chance:</strong> ${weather.rainChance}%</p>
      <p><strong>Jellyfish:</strong> <span class="${rating.jellyfishRisk.className}">${rating.jellyfishRisk.text}</span></p>

      <p><strong>Why:</strong> ${reasonText}</p>
    `;

    card.addEventListener("click", () => {
      map.setView([beach.lat, beach.lng], 14);
    });

    beachList.appendChild(card);

    const arrowIcon = L.divIcon({
      className: "wind-marker",
      html: `
        <div 
          class="wind-arrow ${rating.className}" 
          style="transform: rotate(${weather.windDirectionDegrees}deg);">
          ↑
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    const marker = L.marker([beach.lat, beach.lng], {
      icon: arrowIcon
    })
      .addTo(map)
      .bindPopup(`
        <strong>${beach.name}</strong><br>
        <strong>${rating.status}</strong><br>
        Side: ${beach.side}<br>
        Score: ${rating.score}/100<br>
        Waves: ${weather.waveHeight} m<br>
        Wind: ${rating.windCompass}, ${weather.windSpeed} km/h<br>
        Rain: ${weather.rainChance}%<br>
        Jellyfish: ${rating.jellyfishRisk.text}<br>
        ${reasonText}
      `);

    mapMarkers.push(marker);
  }
}

async function loadApp() {
  const beachList = document.getElementById("beach-list");
  beachList.innerHTML = "Loading live beach conditions...";

  const results = [];

  for (const beach of beaches) {
    try {
      const weather = await getWeatherForBeach(beach);
      const rating = scoreBeach(beach, weather);

      results.push({
        beach,
        weather,
        rating
      });
    } catch (error) {
      console.error("Error loading beach:", beach.name, error);
    }
  }

  results.sort((a, b) => b.rating.score - a.rating.score);

  latestResults = results;

  calculateBestSide(results);
  renderResults(results);
}

function setupDayButtons() {
  const buttons = document.querySelectorAll(".day-button");

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      buttons.forEach(btn => btn.classList.remove("active"));

      button.classList.add("active");
      selectedDay = Number(button.dataset.day);

      loadApp();
    });
  });
}

function setupFilterButtons() {
  const buttons = document.querySelectorAll(".filter-button");

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      buttons.forEach(btn => btn.classList.remove("active"));

      button.classList.add("active");
      activeFilter = button.dataset.filter;

      renderResults(latestResults);
    });
  });
}

function calculateDistanceKm(lat1, lng1, lat2, lng2) {
  const earthRadiusKm = 6371;

  const dLat = degreesToRadians(lat2 - lat1);
  const dLng = degreesToRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function findBestBeachNearUser(userLat, userLng) {
  if (!latestResults.length) {
    alert("Beach data is still loading. Try again in a few seconds.");
    return;
  }

  const ranked = latestResults
    .map(result => {
      const distance = calculateDistanceKm(
        userLat,
        userLng,
        result.beach.lat,
        result.beach.lng
      );

      const combinedScore = result.rating.score - distance * 2;

      return {
        ...result,
        distance,
        combinedScore
      };
    })
    .sort((a, b) => b.combinedScore - a.combinedScore);

  const best = ranked[0];

  alert(
    `Best beach near you: ${best.beach.name}\n` +
      `Score: ${best.rating.score}/100\n` +
      `Distance: ${best.distance.toFixed(1)} km\n` +
      `Status: ${best.rating.status}`
  );

  map.setView([best.beach.lat, best.beach.lng], 14);
}

function setupUserLocation() {
  const locationButton = document.getElementById("location-button");

  if (!locationButton) return;

  locationButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
      alert("Location is not supported by this browser.");
      return;
    }

    locationButton.innerText = "Finding your location...";

    navigator.geolocation.getCurrentPosition(
      position => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        locationButton.innerText = "📍 Find best beach near me";

        if (userMarker) {
          map.removeLayer(userMarker);
        }

        const userIcon = L.divIcon({
          className: "user-marker",
          html: "📍",
          iconSize: [30, 30],
          iconAnchor: [15, 30]
        });

        userMarker = L.marker([userLat, userLng], {
          icon: userIcon
        })
          .addTo(map)
          .bindPopup("You are here")
          .openPopup();

        findBestBeachNearUser(userLat, userLng);
      },
      () => {
        locationButton.innerText = "📍 Find best beach near me";
        alert("Could not access your location. Please allow location permission.");
      }
    );
  });
}

setupDayButtons();
setupFilterButtons();
setupUserLocation();
loadApp();