let selectedDay = 0;
let activeFilters = ["all"];
let mapMarkers = [];
let userMarker = null;
let latestResults = [];

const beaches = [
  { name: "Għadira Bay", side: "North", area: "Mellieħa", type: "Sandy", lat: 35.9706, lng: 14.3578, exposedTo: ["NE", "E"] },
  { name: "Golden Bay", side: "West", area: "Mellieħa", type: "Sandy", lat: 35.9342, lng: 14.3441, exposedTo: ["NW", "W"] },
  { name: "Għajn Tuffieħa", side: "West", area: "Mġarr", type: "Sandy", lat: 35.9289, lng: 14.3444, exposedTo: ["NW", "W"] },
  { name: "Ġnejna Bay", side: "West", area: "Mġarr", type: "Sandy", lat: 35.9192, lng: 14.3405, exposedTo: ["W", "NW"] },
  { name: "Paradise Bay", side: "North", area: "Cirkewwa", type: "Sandy", lat: 35.9895, lng: 14.3291, exposedTo: ["N", "NE"] },
  { name: "Armier Bay", side: "North", area: "Mellieħa", type: "Sandy", lat: 35.9975, lng: 14.3674, exposedTo: ["NE", "E"] },
  { name: "Little Armier", side: "North", area: "Mellieħa", type: "Sandy", lat: 35.9947, lng: 14.3712, exposedTo: ["NE", "E"] },
  { name: "St George's Bay", side: "East", area: "St Julian's", type: "Sandy", lat: 35.9237, lng: 14.4916, exposedTo: ["E", "NE"] },
  { name: "Balluta Bay", side: "East", area: "Sliema", type: "Rocky", lat: 35.9149, lng: 14.4965, exposedTo: ["E"] },
  { name: "Exiles Beach", side: "East", area: "Sliema", type: "Rocky", lat: 35.9123, lng: 14.5002, exposedTo: ["E"] },
  { name: "Fond Għadir", side: "East", area: "Sliema", type: "Rocky", lat: 35.9095, lng: 14.5042, exposedTo: ["E"] },
  { name: "Buġibba Perched Beach", side: "North", area: "Buġibba", type: "Artificial", lat: 35.9519, lng: 14.4148, exposedTo: ["N", "NE"] },
  { name: "Qawra Point", side: "North", area: "Qawra", type: "Rocky", lat: 35.9572, lng: 14.4232, exposedTo: ["N", "NE"] },
  { name: "Pretty Bay", side: "South", area: "Birżebbuġa", type: "Sandy", lat: 35.8256, lng: 14.5269, exposedTo: ["SE", "S"] },
  { name: "St Peter's Pool", side: "South", area: "Marsaxlokk", type: "Rocky", lat: 35.8322, lng: 14.5624, exposedTo: ["S", "SE"] },
  { name: "Ramla Bay", side: "North", area: "Gozo", type: "Sandy", lat: 36.0612, lng: 14.2847, exposedTo: ["N", "NE"] },
  { name: "Xlendi Bay", side: "West", area: "Gozo", type: "Rocky", lat: 36.0283, lng: 14.2146, exposedTo: ["SW", "W"] },
  { name: "Hondoq ir-Rummien", side: "East", area: "Gozo", type: "Rocky", lat: 36.0182, lng: 14.3294, exposedTo: ["E", "SE"] },
  { name: "Blue Lagoon", side: "North", area: "Comino", type: "Rocky", lat: 36.0146, lng: 14.3317, exposedTo: ["N", "NE"] }
];

const map = L.map("map", {
  zoomControl: false
}).setView([35.9375, 14.3754], 11);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

L.control.zoom({ position: "bottomright" }).addTo(map);

function setStatus(message) {
  document.getElementById("status-message").textContent = message;
}

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

function degreesToCompass(degrees) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("API request failed");
  }

  return response.json();
}

async function getWeatherForBeach(beach) {
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${beach.lat}&longitude=${beach.lng}` +
    `&hourly=wind_speed_10m,wind_direction_10m,precipitation_probability&forecast_days=3`;

  const marineUrl =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${beach.lat}&longitude=${beach.lng}` +
    `&hourly=wave_height&forecast_days=3`;

  const [weatherData, marineData] = await Promise.all([
    fetchJson(weatherUrl),
    fetchJson(marineUrl)
  ]);

  const hourIndex = getForecastHourIndex(selectedDay);

  return {
    windSpeed: weatherData.hourly.wind_speed_10m[hourIndex] ?? 0,
    windDirectionDegrees: weatherData.hourly.wind_direction_10m[hourIndex] ?? 0,
    rainChance: weatherData.hourly.precipitation_probability[hourIndex] ?? 0,
    waveHeight: marineData.hourly.wave_height[hourIndex] ?? 0
  };
}

function calculateJellyfishRisk(windCompass, beach) {
  if (beach.exposedTo.includes(windCompass)) {
    return {
      level: "High",
      text: "Higher risk due to wind"
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
      text: "Possible risk"
    };
  }

  return {
    level: "Low",
    text: "Lower risk"
  };
}

function scoreBeach(beach, weather) {
  let score = 100;
  const reasons = [];
  const windCompass = degreesToCompass(weather.windDirectionDegrees);
  const jellyfishRisk = calculateJellyfishRisk(windCompass, beach);

  if (weather.waveHeight > 1) {
    score -= 50;
    reasons.push("high waves");
  } else if (weather.waveHeight > 0.5) {
    score -= 25;
    reasons.push("moderate waves");
  }

  if (weather.windSpeed > 25) {
    score -= 20;
    reasons.push("strong wind");
  }

  if (beach.exposedTo.includes(windCompass)) {
    score -= 30;
    reasons.push("wind blowing into beach");
  }

  if (weather.rainChance > 50) {
    score -= 15;
    reasons.push("chance of rain");
  }

  if (jellyfishRisk.level === "High") {
    score -= 15;
    reasons.push("possible jellyfish risk");
  }

  score = Math.max(0, Math.round(score));

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

async function loadBeachConditions() {
  setStatus("Loading live beach conditions...");
  document.getElementById("beach-list").innerHTML = "";

  const promises = beaches.map(async beach => {
    try {
      const weather = await getWeatherForBeach(beach);
      const rating = scoreBeach(beach, weather);

      return {
        beach,
        weather,
        rating,
        error: false
      };
    } catch (error) {
      console.error("Could not load beach:", beach.name, error);

      return {
        beach,
        weather: null,
        rating: null,
        error: true
      };
    }
  });

  const results = await Promise.all(promises);

  latestResults = results
    .filter(result => !result.error)
    .sort((a, b) => b.rating.score - a.rating.score);

  if (!latestResults.length) {
    setStatus("Could not load beach conditions. Please try again later.");
    return;
  }

  setStatus(`Showing conditions for ${getSelectedDayLabel()}.`);
  renderBestSide(latestResults);
  renderResults();
}

function renderBestSide(results) {
  const sideScores = {
    North: [],
    South: [],
    East: [],
    West: []
  };

  results.forEach(result => {
    sideScores[result.beach.side].push(result.rating.score);
  });

  let bestSide = "Unknown";
  let bestAverage = 0;

  Object.keys(sideScores).forEach(side => {
    const scores = sideScores[side];

    if (!scores.length) return;

    const average = scores.reduce((total, score) => total + score, 0) / scores.length;

    if (average > bestAverage) {
      bestAverage = average;
      bestSide = side;
    }
  });

  document.getElementById("best-side-banner").innerHTML =
    `🌊 Best side of Malta ${getSelectedDayLabel()}: <strong>${bestSide}</strong><br>` +
    `${Math.round(bestAverage)}/100 average conditions`;
}

function filterResults(results) {
  if (activeFilters.includes("all")) {
    return results;
  }

  return results.filter(result => {
    return activeFilters.every(filter => {
      return result.beach.type === filter || result.beach.side === filter;
    });
  });
}

function clearMapMarkers() {
  mapMarkers.forEach(marker => {
    map.removeLayer(marker);
  });

  mapMarkers = [];
}

function getWindArrow(weather) {
  let windClass = "best";

  if (weather.windSpeed > 20) {
    windClass = "avoid";
  } else if (weather.windSpeed > 10) {
    windClass = "good";
  }

  return `
    <div class="wind-arrow ${windClass}" style="transform: rotate(${weather.windDirectionDegrees}deg);">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path
          d="M32 4 L54 60 L32 48 L10 60 Z"
          fill="currentColor"
          stroke="white"
          stroke-width="3"
          stroke-linejoin="round"
        ></path>
      </svg>
    </div>
  `;
}

function renderResults() {
  const beachList = document.getElementById("beach-list");
  const filteredResults = filterResults(latestResults);

  beachList.innerHTML = "";
  clearMapMarkers();

  if (!filteredResults.length) {
    beachList.innerHTML = `<p>No beaches match these filters.</p>`;
    return;
  }

  filteredResults.forEach(result => {
    const { beach, weather, rating } = result;

    const reasonText = rating.reasons.length
      ? rating.reasons.join(", ")
      : "good swimming conditions";

    const card = document.createElement("div");
    card.className = `beach-card ${rating.className}-card`;

    card.innerHTML = `
      <h3>${beach.name}</h3>
      <span class="badge ${rating.className}">${rating.status}</span>
      <p>${beach.area} • ${beach.type} • ${beach.side}</p>
      <p>🌬 Wind: ${rating.windCompass}, ${Math.round(weather.windSpeed)} km/h</p>
      <p>🌊 Waves: ${weather.waveHeight.toFixed(1)}m</p>
      <p>🌧 Rain chance: ${Math.round(weather.rainChance)}%</p>
      <p>🪼 Jellyfish: ${rating.jellyfishRisk.text}</p>
      <p>⭐ Score: ${rating.score}/100</p>
      <p><strong>Why:</strong> ${reasonText}</p>
    `;

    card.addEventListener("click", () => {
      map.setView([beach.lat, beach.lng], 14);
    });

    beachList.appendChild(card);

    const markerIcon = L.divIcon({
      className: "wind-marker",
      html: getWindArrow(weather),
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    const marker = L.marker([beach.lat, beach.lng], {
      icon: markerIcon
    })
      .addTo(map)
      .bindPopup(`
        <strong>${beach.name}</strong><br>
        ${rating.status}<br>
        Score: ${rating.score}/100<br>
        Wind: ${rating.windCompass}, ${Math.round(weather.windSpeed)} km/h<br>
        Waves: ${weather.waveHeight.toFixed(1)}m<br>
        Jellyfish: ${rating.jellyfishRisk.text}
      `);

    mapMarkers.push(marker);
  });
}

function setupDayButtons() {
  document.querySelectorAll(".day-button").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".day-button").forEach(item => {
        item.classList.remove("active");
      });

      button.classList.add("active");
      selectedDay = Number(button.dataset.day);

      loadBeachConditions();
    });
  });
}

function setupFilterButtons() {
  document.querySelectorAll(".filter-button").forEach(button => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;

      if (filter === "all") {
        activeFilters = ["all"];

        document.querySelectorAll(".filter-button").forEach(item => {
          item.classList.remove("active");
        });

        button.classList.add("active");
      } else {
        const allButton = document.querySelector('[data-filter="all"]');

        activeFilters = activeFilters.filter(item => item !== "all");

        if (allButton) {
          allButton.classList.remove("active");
        }

        if (activeFilters.includes(filter)) {
          activeFilters = activeFilters.filter(item => item !== filter);
          button.classList.remove("active");
        } else {
          activeFilters.push(filter);
          button.classList.add("active");
        }

        if (!activeFilters.length) {
          activeFilters = ["all"];

          if (allButton) {
            allButton.classList.add("active");
          }
        }
      }

      renderResults();
    });
  });
}

function setupUserLocation() {
  const locationButton = document.getElementById("location-button");

  locationButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
      alert("Location is not supported by this browser.");
      return;
    }

    locationButton.textContent = "Finding your location...";

    navigator.geolocation.getCurrentPosition(
      position => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        locationButton.textContent = "📍 Near me";

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

        map.setView([userLat, userLng], 12);
      },
      () => {
        locationButton.textContent = "📍 Near me";
        alert("Could not access your location.");
      }
    );
  });
}

function startApp() {
  setupDayButtons();
  setupFilterButtons();
  setupUserLocation();
  loadBeachConditions();
}

startApp();