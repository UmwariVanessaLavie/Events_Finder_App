# Music Event Finder

Music Event Finder is a web application that allows users to search for upcoming music events by artist or city using the Ticketmaster Discovery API v2. The app features a responsive, accessible interface with a light theme, localStorage caching for performance, and error handling for a seamless user experience.

## Features
- **Search Events**: Search for music events by artist name or city.
- **Featured Events**: Displays upcoming music events in New York by default.
- **Clear Search**: Resets the search and reloads featured events.
- **Responsive Design**: Mobile-friendly layout with a clean, light theme (coral and teal accents).
- **Accessibility**: ARIA labels and roles for screen reader compatibility.
- **Caching**: Uses localStorage to cache search results, reducing API calls.
- **Error Handling**: Displays user-friendly messages for invalid searches or API errors.

## Prerequisites
- **Node.js**: Not required for running the app, but useful for local development servers (e.g., `npx serve`).
- **Docker**: Required for containerized deployment.
- **Ticketmaster API Key**: Obtain a free API key from [Ticketmaster Developer Portal](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/).
- **Web Servers**: Two Ubuntu-based servers with Docker and Nginx installed for deployment.
- **Load Balancer**: A separate Ubuntu server with Docker and HAProxy for load balancing.

## API Used
- **Ticketmaster Discovery API v2**: Used to fetch music event data.
  - **Documentation**: [Ticketmaster Discovery API v2](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/)
  - **Details**: Provides access to over 230,000 events across multiple countries, with filters for music events (`classificationName=music`), artist (`keyword`), city, and more. Requires an API key passed via the `apikey` query parameter.
  - **Rate Limits**: 5000 API calls per day, 5 requests per second.
  - **Credits**: Thanks to Ticketmaster for providing a robust and free API for event data.

## Development Challenges
During development, I faced challenges finding a suitable API for music events:
- **Challenge**: Searched for multiple music-specific event APIs but found none that were free and comprehensive. Most APIs were either paid, limited in scope, or not music-focused.
- **Solution**: Adopted the Ticketmaster Discovery API, which includes music events among other event types. This required pivoting the project from a "Music Event Finder" to a general "Event Finder" focused on music events by using the `classificationName=music` filter. The API's flexibility allowed me to maintain the original functionality with minimal changes.

## Local Setup Instructions
1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd music-event-finder
   ```
2. **Add API Key**:
   - Replace `YOUR_TICKETMASTER_API_KEY` in `script.js` with your Ticketmaster API key.
3. **Run Locally**:
   - Use a local server to avoid CORS issues:
     ```bash
     npx serve
     ```
     Or, with Python:
     ```bash
     python -m http.server 8000
     ```
   - Open `http://localhost:8000` (or the relevant port) in a browser.
4. **Usage**:
   - The homepage displays featured music events in New York.
   - Enter an artist name or city in the search bar to find events.
   - Click "Clear Search" to reset and reload featured events.

## Deployment Instructions
The application is containerized using Docker and deployed on two Ubuntu-based web servers with Nginx, behind an HAProxy load balancer with SSL termination for HTTPS.

### Docker Hub Repository
- **URL**: [docker.io/<your-username>/music-event-finder](https://hub.docker.com/r/<your-username>/music-event-finder) (replace `<your-username>` with your Docker Hub username)
- **Image Name**: `music-event-finder`
- **Tags**:
  - `latest`: Latest stable build
  - `v1.0`: Initial release with Ticketmaster API integration

### Build Instructions
1. **Create a Dockerfile** in the project root:
   ```Dockerfile
   FROM nginx:alpine
   COPY . /usr/share/nginx/html
   EXPOSE 80
   CMD ["nginx", "-g", "daemon off;"]
   ```
2. **Build the Docker Image**:
   ```bash
   docker build -t <your-username>/music-event-finder:latest .
   ```
3. **Push to Docker Hub** (optional):
   ```bash
   docker login
   docker push <your-username>/music-event-finder:latest
   ```

### Run Instructions
On each web server (Web01 and Web02):
1. **Pull the Image**:
   ```bash
   docker pull <your-username>/music-event-finder:latest
   ```
2. **Run the Container**:
   - Web01:
     ```bash
     docker run -d -p 80:80 --name music-event-finder-web01 \
     -e NGINX_PORT=80 \
     -e X_SERVED_BY=web01 \
     <your-username>/music-event-finder:latest
     ```
   - Web02:
     ```bash
     docker run -d -p 80:80 --name music-event-finder-web02 \
     -e NGINX_PORT=80 \
     -e X_SERVED_BY=web02 \
     <your-username>/music-event-finder:latest
     ```
3. **Configure Nginx for Custom Headers**:
   - On each server, edit `/etc/nginx/conf.d/default.conf` inside the container to add a custom header:
     ```nginx
     server {
         listen 80;
         server_name localhost;
         add_header X-Served-By $X_SERVED_BY;
         location / {
             root /usr/share/nginx/html;
             index index.html;
         }
     }
     ```
   - Restart Nginx in each container:
     ```bash
     docker exec music-event-finder-web01 nginx -s reload
     docker exec music-event-finder-web02 nginx -s reload
     ```
4. **SSL Termination**:
   - Install SSL certificates (e.g., via Let's Encrypt) on Web01 and Web02.
   - Update Nginx to listen on port 443 with SSL:
     ```nginx
     server {
         listen 443 ssl;
         server_name <your-domain>;
         ssl_certificate /etc/nginx/certs/fullchain.pem;
         ssl_certificate_key /etc/nginx/certs/privkey.pem;
         add_header X-Served-By $X_SERVED_BY;
         location / {
             root /usr/share/nginx/html;
             index index.html;
         }
     }
     ```
   - Mount SSL certificates into the container:
     ```bash
     docker run -d -p 443:443 --name music-event-finder-web01 \
     -v /path/to/certs:/etc/nginx/certs \
     -e NGINX_PORT=443 \
     -e X_SERVED_BY=web01 \
     <your-username>/music-event-finder:latest
     ```
     Repeat for Web02.

### Load Balancer Configuration
A third Docker container runs HAProxy on an Ubuntu server to distribute traffic using the round-robin algorithm.

1. **HAProxy Dockerfile**:
   ```Dockerfile
   FROM haproxy:alpine
   COPY haproxy.cfg /usr/local/etc/haproxy/haproxy.cfg
   EXPOSE 443
   CMD ["haproxy", "-f", "/usr/local/etc/haproxy/haproxy.cfg"]
   ```

2. **HAProxy Configuration** (`haproxy.cfg`):
   ```haproxy
   global
       log stdout format raw local0
       maxconn 4096

   defaults
       log global
       mode http
       timeout connect 5000ms
       timeout client 50000ms
       timeout server 50000ms

   frontend http_front
       bind *:443 ssl crt /usr/local/etc/haproxy/certs/combined.pem
       default_backend app_backend

   backend app_backend
       balance roundrobin
       server web01 <web01-ip>:443 ssl verify none
       server web02 <web02-ip>:443 ssl verify none
   ```
   - Replace `<web01-ip>` and `<web02-ip>` with the private IPs of Web01 and Web02.
   - Combine SSL certificate and key into `combined.pem` and mount it to the container.

3. **Build and Run HAProxy**:
   ```bash
   docker build -t <your-username>/music-event-finder-haproxy:latest .
   docker run -d -p 443:443 --name haproxy \
   -v /path/to/certs:/usr/local/etc/haproxy/certs \
   <your-username>/music-event-finder-haproxy:latest
   ```

4. **Reload HAProxy** (after config changes):
   ```bash
   docker exec haproxy haproxy -f /usr/local/etc/haproxy/haproxy.cfg -p /var/run/haproxy.pid -sf $(cat /var/run/haproxy.pid)
   ```

### Testing Steps & Evidence
To verify round-robin load balancing:
1. **Send Requests**:
   ```bash
   curl -k https://<load-balancer-ip-or-domain> -v
   ```
2. **Check Headers**:
   - Inspect the `X-Served-By` header in responses.
   - Example output alternates between servers:
     ```
     < X-Served-By: web01
     ```
     ```
     < X-Served-By: web02
     ```
3. **Test Multiple Requests**:
   ```bash
   for i in {1..4}; do curl -k https://<load-balancer-ip-or-domain> -v 2>&1 | grep X-Served-By; done
   ```
   - Expected output shows alternation:
     ```
     < X-Served-By: web01
     < X-Served-By: web02
     < X-Served-By: web01
     < X-Served-By: web02
     ```
4. **HTTPS Verification**:
   - Ensure requests to `http://<load-balancer-ip>` redirect to `https://<load-balancer-ip>` or fail, confirming SSL termination.

### Hardening Step: Managing API Keys
To avoid baking the Ticketmaster API key into the image:
1. **Use Environment Variables**:
   - Modify `script.js` to read the API key from an environment variable:
     ```javascript
     const API_KEY = process.env.TICKETMASTER_API_KEY || 'YOUR_TICKETMASTER_API_KEY';
     ```
2. **Pass Environment Variable to Container**:
   - Update the Docker run command:
     ```bash
     docker run -d -p 443:443 --name music-event-finder-web01 \
     -v /path/to/certs:/etc/nginx/certs \
     -e NGINX_PORT=443 \
     -e X_SERVED_BY=web01 \
     -e TICKETMASTER_API_KEY=<your-api-key> \
     <your-username>/music-event-finder:latest
     ```
3. **Serve API Key via Nginx**:
   - Add a script to Nginx that exposes the API key as a variable:
     ```nginx
     server {
         listen 443 ssl;
         server_name <your-domain>;
         ssl_certificate /etc/nginx/certs/fullchain.pem;
         ssl_certificate_key /etc/nginx/certs/privkey.pem;
         add_header X-Served-By $X_SERVED_BY;
         location / {
             root /usr/share/nginx/html;
             index index.html;
         }
         location /api-key {
             return 200 'window.TICKETMASTER_API_KEY="$TICKETMASTER_API_KEY";';
             default_type application/javascript;
         }
     }
     ```
   - Update `script.js` to fetch the key dynamically:
     ```javascript
     async function getApiKey() {
         const response = await fetch('/api-key');
         const script = await response.text();
         eval(script); // Sets window.TICKETMASTER_API_KEY
         return window.TICKETMASTER_API_KEY;
     }
     const API_KEY = await getApiKey();
     ```
4. **Secure Storage** (Recommended):
   - Store the API key in a secrets management tool (e.g., AWS Secrets Manager, HashiCorp Vault) and inject it into the container at runtime.
   - Alternatively, use a `.env` file locally (excluded from version control via `.gitignore`) and load it into the container environment.

## Credits
- **Ticketmaster**: For providing the Discovery API v2, enabling access to comprehensive event data.
- **Nginx**: For serving the web application efficiently.
- **HAProxy**: For reliable load balancing.
- **Docker**: For containerization, simplifying deployment.
- **Let's Encrypt**: For free SSL certificates to enable HTTPS.
- **xAI (Grok)**: For assisting in code generation, debugging, and documentation.

## License
MIT License. See [LICENSE](LICENSE) for details.