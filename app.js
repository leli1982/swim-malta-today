const firebaseConfig = {
  apiKey: "AIzaSyBmlSyovip8LHGYKEK5HlTqLbo8ShE1Gk8",
  authDomain: "swim-malta-today.firebaseapp.com",
  projectId: "swim-malta-today",
  storageBucket: "swim-malta-today.firebasestorage.app",
  messagingSenderId: "281555853040",
  appId: "1:281555853040:web:556923cdddecd4d7ceec35",
  measurementId: "G-XWX75BBN6V"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let selectedDay = 0;
let activeFilters = ["all"];
let mapMarkers = [];
let userMarker = null;
let latestResults = [];
let selectedReportType = "";
let jellyfishReports = [];

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

const map = L.map("map", { zoomControl: false }).setView([35.9375, 14.3754], 11);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

L.control.zoom({ position: "bottomright" }).addTo(map);

function populateBeachDropdown() {
  const select = document.getElementById("report-beach");
  if (!select) return;

  select.innerHTML = "";

  beaches.forEach(beach => {
    const option = document.createElement("option");
    option.value = beach.name;
    option.innerText = beach.name;
    select.appendChild(option);
  });
}

function getForecastHourIndex(day) {
  if (day === 0) return new Date().getHours();
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
    `&hourly=wind_speed_10m,wind_direction_10m,precipitation_probability&forecast_days=3`;

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

function calculateJellyfishRisk(windCompass, beach) {
  const recentReports = jellyfishReports.filter(report => {
    const isSameBeach = report.beach === beach.name;
    const isRecent = Date.now() - report.timestamp < 24 * 60 * 60 * 1000;
    return isSameBeach && isRecent;
  });

  const manyReports = recentReports.filter(report => report.report === "Many Jellyfish");
  const someReports = recentReports.filter(report => report.report === "Some Jellyfish");
  const clearReports = recentReports.filter(report => report.report === "No Jellyfish");

  if (manyReports.length > 0) {
    return { level: "High", className: "jellyfish-high", text: "Community reported" };
  }

  if (someReports.length > 0) {
    return { level: "Medium", className: "jellyfish-medium", text: "Some reported" };
  }

  if (clearReports.length > 0) {
    return { level: "Low", className: "jellyfish-low", text: "Reported clear" };
  }

  if (beach.exposedTo.includes(windCompass)) {
    return { level: "High", className: "jellyfish-high", text: "High risk" };
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
  const hasNearbyExposure = beach.exposedTo.some(direction => nearbyDirections.includes(direction));

  if (hasNearbyExposure) {
    return { level: "Medium", className: "jellyfish-medium", text: "Possible risk" };
  }

  return { level: "Low", className: "jellyfish-low", text: "Low risk" };
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
    reasons.push("Wind blowing into beach");
  }

  if (weather.rainChance > 50) {
    score -= 15;
    reasons.push("Chance of rain");
  }

  const jellyfishRisk = calculateJellyfishRisk(windCompass, beach);

  if (jellyfishRisk.level === "High") {
    score -= 25;
    reasons.push("Jellyfish risk");
  } else if (jellyfishRisk.level === "Medium") {
    score -= 10;
    reasons.push("Possible jellyfish risk");
  }

  if (score < 0) score = 0;

  let status = "Best";
  let className = "best";

  if (score < 60) {
    status = "Avoid";
    className = "avoid";
  } else if (score < 80) {
    status = "Good";
    className = "good";
  }

  return { score, status, className, windCompass, reasons, jellyfishRisk };
}

function calculateBestSide(results) {
  const sideScores = { North: [], South: [], East: [], West: [] };

  results.forEach(result => {
    sideScores[result.beach.side].push(result.rating.score);
  });

  let bestSide = "";
  let bestAverage = 0;

  for (const side in sideScores) {
    const scores = sideScores[side];
    if (!scores.length) continue;

    const average = scores.reduce((a, b) => a + b, 0) / scores.length;

    if (average > bestAverage) {
      bestAverage = average;
      bestSide = side;
    }
  }

  document.getElementById("best-side-banner").innerHTML =
    `🌊 Best side of Malta ${getSelectedDayLabel()}: ` +
    `<strong>${bestSide}</strong><br>` +
    `${Math.round(bestAverage)}/100 average conditions`;
}

function clearMapMarkers() {
  mapMarkers.forEach(marker => map.removeLayer(marker));
  mapMarkers = [];
}

function filterResults(results) {
  if (activeFilters.includes("all")) return results;

  return results.filter(result => {
    return activeFilters.every(filter => {
      if (filter === "jellyfish-safe") {
        return result.rating.jellyfishRisk.level === "Low";
      }

      return result.beach.type === filter || result.beach.side === filter;
    });
  });
}

function getWindArrow(weather) {
  let windClass = "best";

  if (weather.windSpeed > 20) {
    windClass = "avoid";
  } else if (weather.windSpeed > 10) {
    windClass = "good";
  }

  return `
    <div 
      class="wind-arrow ${windClass}" 
      style="transform: rotate(${weather.windDirectionDegrees}deg);"
    >
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path 
          d="M32 4 L54 60 L32 48 L10 60 Z" 
          fill="currentColor"
          stroke="white"
          stroke-width="3"
          stroke-linejoin="round"
        />
      </svg>
    </div>
  `;
}

function renderResults(results) {
  const beachList = document.getElementById("beach-list");
  beachList.innerHTML = "";

  clearMapMarkers();

  const filteredResults = filterResults(results);

  if (!filteredResults.length) {
    beachList.innerHTML = "No beaches match these filters.";
    return;
  }

  filteredResults.forEach(result => {
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
      <p>${beach.area} • ${beach.type} • ${beach.side}</p>
      <p>🌬 ${rating.windCompass} ${weather.windSpeed} km/h</p>
      <p>🌊 ${weather.waveHeight}m waves</p>
      <p>🌧 ${weather.rainChance}% rain chance</p>
      <p>🪼 <span class="${rating.jellyfishRisk.className}">${rating.jellyfishRisk.text}</span></p>
      <p>⭐ ${rating.score}/100</p>
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
        Wind: ${rating.windCompass} ${weather.windSpeed} km/h<br>
        Waves: ${weather.waveHeight}m<br>
        Jellyfish: ${rating.jellyfishRisk.text}
      `);

    mapMarkers.push(marker);
  });
}

async function loadApp() {
  const beachList = document.getElementById("beach-list");
  beachList.innerHTML = "Loading live beach conditions...";

  const results = [];

  for (const beach of beaches) {
    try {
      const weather = await getWeatherForBeach(beach);
      const rating = scoreBeach(beach, weather);
      results.push({ beach, weather, rating });
    } catch (error) {
      console.error("Error loading beach:", beach.name, error);
    }
  }

  results.sort((a, b) => b.rating.score - a.rating.score);

  latestResults = results;

  calculateBestSide(results);
  renderResults(results);
}

function setupRealtimeJellyfishReports() {
  db.collection("jellyfishReports")
    .orderBy("timestamp", "desc")
    .limit(200)
    .onSnapshot(snapshot => {
      jellyfishReports = [];

      snapshot.forEach(doc => {
        jellyfishReports.push(doc.data());
      });

      if (latestResults.length) {
        loadApp();
      }
    });
}

function setupDayButtons() {
  document.querySelectorAll(".day-button").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".day-button").forEach(btn =>
        btn.classList.remove("active")
      );

      button.classList.add("active");
      selectedDay = Number(button.dataset.day);

      loadApp();
    });
  });
}

function setupFilterButtons() {
  document.querySelectorAll(".filter-button").forEach(button => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;

      if (filter === "all") {
        activeFilters = ["all"];

        document.querySelectorAll(".filter-button").forEach(btn =>
          btn.classList.remove("active")
        );

        button.classList.add("active");
      } else {
        activeFilters = activeFilters.filter(item => item !== "all");

        const allButton = document.querySelector('[data-filter="all"]');

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

        if (activeFilters.length === 0) {
          activeFilters = ["all"];

          if (allButton) {
            allButton.classList.add("active");
          }
        }
      }

      renderResults(latestResults);
    });
  });
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

        locationButton.innerText = "📍 Near me";

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
        locationButton.innerText = "📍 Near me";
        alert("Could not access your location. Please allow location permission.");
      }
    );
  });
}

function setupReportPanel() {
  const reportButton = document.getElementById("report-button");
  const panel = document.getElementById("jellyfish-panel");
  const closeButton = document.getElementById("close-report");

  if (!reportButton || !panel || !closeButton) return;

  reportButton.addEventListener("click", () => {
    panel.classList.remove("hidden");
  });

  closeButton.addEventListener("click", () => {
    panel.classList.add("hidden");
  });

  document.querySelectorAll(".report-choice").forEach(choice => {
    choice.addEventListener("click", () => {
      selectedReportType = choice.dataset.report;

      document.querySelectorAll(".report-choice").forEach(btn => {
        btn.style.background = "white";
      });

      choice.style.background = "#e8f5ff";
    });
  });

  document.getElementById("submit-report").addEventListener("click", async () => {
    const beach = document.getElementById("report-beach").value;
    const comment = document.getElementById("report-comment").value;

    if (!selectedReportType) {
      alert("Please select a report type.");
      return;
    }

    await db.collection("jellyfishReports").add({
      beach,
      report: selectedReportType,
      comment,
      timestamp: Date.now()
    });

    alert("Report submitted!");

    document.getElementById("report-comment").value = "";
    selectedReportType = "";

    document.querySelectorAll(".report-choice").forEach(btn => {
      btn.style.background = "white";
    });

    panel.classList.add("hidden");
  });
}

populateBeachDropdown();
setupRealtimeJellyfishReports();
setupDayButtons();
setupFilterButtons();
setupUserLocation();
setupReportPanel();
loadApp();