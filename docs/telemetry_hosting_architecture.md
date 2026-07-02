# Infrastructure and Telemetry Hosting Architecture

This document reviews the deployment requirements for the Fall 2026 pilot study (20 students, ~2 hours/week, 4 weeks) and outlines the architecture for hosting and data collection.

## Review of Initial Assessment

The assessment provided by the Gemini web app is **accurate and highly recommended** for this architecture. 

> [!IMPORTANT]
> The Client-Server Proxy is the most critical component. Embedding API keys directly into an IDE extension distributed to students is a severe security risk. The proxy pattern mitigates this entirely.

---

## Architecture Breakdown for the Pilot Study

Given the scale of the pilot (roughly 160 total hours of active usage over a month), the infrastructure can be lightweight but must remain robust enough to capture all telemetry securely.

### 1. The Client-Server Proxy (Compute Layer)
- **Purpose:** Acts as the middleman between the Eclipse IDE and the frontier AI models. It authenticates requests, injects concept-aligned drift for the study, and securely holds the API keys.
- **Implementation:** A lightweight Node.js (Express/Fastify) or Python (FastAPI) server.
- **Hosting Recommendations:** 
  - **Platform-as-a-Service (PaaS):** Heroku, Render, or Railway are excellent, low-maintenance options for a pilot. 
  - **Serverless:** AWS Lambda or Google Cloud Functions are highly scalable and cost-effective, but may require more setup.

### 2. Supporting Database Infrastructure (Data Layer)
- **Purpose:** Store telemetry, track milestones, and archive project artifacts for grant application analysis.
- **Implementation:** A relational database is highly recommended due to the structured nature of telemetry and milestone tracking.
- **Hosting Recommendations:**
  - **Managed PostgreSQL:** AWS RDS is robust but can be overkill. 
  - **BaaS (Backend-as-a-Service):** **Supabase** or **Firebase** are ideal for this scale. Supabase provides a managed PostgreSQL database with easy-to-use APIs, making it very straightforward to ingest telemetry data directly from the proxy server.

### 3. Extension Distribution (Storage Layer)
- **Purpose:** Host the Eclipse Update Site (P2 Repository) so students can easily install and update the plugin.
- **Implementation:** A static file server. The Eclipse IDE will periodically ping this URL for updates.
- **Hosting Recommendations:**
  - **GitHub Pages:** Free, easy to set up, and highly reliable for open-source or educational projects.
  - **AWS S3 / Google Cloud Storage:** Extremely cheap static hosting if the repository needs to remain private or requires specific access controls.

## Data Flow Summary

1. **Student Action:** Student interacts with the Eclipse plugin.
2. **Telemetry Dispatch:** The plugin sends a background HTTP POST request to the **Client-Server Proxy**.
3. **Processing & Storage:** The proxy validates the request, logs the telemetry and artifacts to the **Database (e.g., Supabase)**.
4. **AI Interaction:** If the student requested AI assistance, the proxy securely calls the AI Model's API, applies any necessary study-specific logic (drift), and returns the response to the Eclipse IDE.
