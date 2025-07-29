// Ticketmaster API key (replace with your own)
const API_KEY = '0GwDcKNQ3qQUcHxbrOocmfp7LKxRJ48W';

// DOM elements
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const clearBtn = document.getElementById('clear-btn');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const results = document.getElementById('results');

// Debounce function to limit API calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Fetch events from Ticketmaster API
async function fetchEvents(query = null) {
    try {
        // Show loading spinner
        loading.style.display = 'block';
        error.style.display = 'none';

        let url;
        let cacheKey = 'events_featured';
        if (!query) {
            // Fetch featured music events in New York
            url = `https://app.ticketmaster.com/discovery/v2/events.json?classificationName=music&city=New%20York&countryCode=US&size=10&apikey=${API_KEY}`;
        } else {
            cacheKey = `events_${query}`;
            // Check localStorage cache
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }

            // Try artist search
            url = `https://app.ticketmaster.com/discovery/v2/events.json?classificationName=music&keyword=${encodeURIComponent(query)}&countryCode=US&size=10&apikey=${API_KEY}`;
        }

        let response = await fetch(url);
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Invalid API key. Please check your Ticketmaster API key.');
            }
            throw new Error('Failed to fetch events. Please try again later.');
        }
        let data = await response.json();
        let events = data._embedded?.events || [];

        // If artist search returns nothing, try city search
        if (query && events.length === 0) {
            url = `https://app.ticketmaster.com/discovery/v2/events.json?classificationName=music&city=${encodeURIComponent(query)}&countryCode=US&size=10&apikey=${API_KEY}`;
            response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch events for city. Please try again.');
            }
            data = await response.json();
            events = data._embedded?.events || [];
        }

        // Cache results in localStorage
        localStorage.setItem(cacheKey, JSON.stringify(events));
        return events;
    } catch (err) {
        throw new Error(err.message);
    } finally {
        loading.style.display = 'none';
    }
}

// Display events in card format
function displayEvents(events) {
    results.innerHTML = '';
    if (!events || events.length === 0) {
        error.style.display = 'block';
        error.textContent = 'No events found for your search.';
        return;
    }

    events.forEach(event => {
        const card = document.createElement('div');
        card.className = 'event-card';

        const date = new Date(event.dates.start.localDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        const artistName = event._embedded?.attractions?.[0]?.name || event.name || 'Various Artists';
        const venueName = event._embedded?.venues?.[0]?.name || 'TBD';
        const city = event._embedded?.venues?.[0]?.city?.name || 'Unknown';
        const country = event._embedded?.venues?.[0]?.country?.countryCode || 'US';

        card.innerHTML = `
            <h3>${artistName}</h3>
            <p><strong>Date:</strong> ${date}</p>
            <p><strong>Venue:</strong> ${venueName}</p>
            <p><strong>City:</strong> ${city}, ${country}</p>
            ${event.url ? 
                `<p><a href="${event.url}" target="_blank" aria-label="Get tickets for ${artistName} at ${venueName}">Get Tickets</a></p>` : 
                '<p>No ticket link available</p>'
            }
        `;
        results.appendChild(card);
    });
}

// Handle form submission
async function handleSearch(e) {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) {
        error.style.display = 'block';
        error.textContent = 'Please enter an artist name or city.';
        return;
    }

    try {
        const events = await fetchEvents(query);
        displayEvents(events);
    } catch (err) {
        error.style.display = 'block';
        error.textContent = err.message;
    }
}

// Clear search and show featured events
async function clearSearch() {
    searchInput.value = '';
    results.innerHTML = '';
    error.style.display = 'none';
    localStorage.clear();
    try {
        const featuredEvents = await fetchEvents();
        displayEvents(featuredEvents);
    } catch (err) {
        error.style.display = 'block';
        error.textContent = 'Failed to load featured events.';
    }
}

// Event listeners
searchForm.addEventListener('submit', handleSearch);
searchInput.addEventListener('keypress', debounce((e) => {
    if (e.key === 'Enter') {
        handleSearch(e);
    }
}, 300));
clearBtn.addEventListener('click', clearSearch);

// Load featured events on page load
window.addEventListener('load', clearSearch);