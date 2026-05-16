# Protype Dashboard

A full-stack dashboard application for tracking cohort/student progress in a coding camp with automated data scraping from Dicoding Coding Camp.

## Features

- Student progress tracking with status indicators
- KPI cards for quick metrics overview
- Cohort management dashboard
- Responsive design with modern UI
- **Automated scraping** from Dicoding Coding Camp (real-time data)
- **Dynamic credential input** - Enter credentials in the UI (no .env configuration needed)
- **Multi-user support** - Each user can scrape with their own credentials
- RESTful API for data access
- Docker containerization for easy deployment
- Real-time scraping progress with automatic polling

## Tech Stack

### Frontend
- **Vite** - Fast build tool and dev server
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Accessible UI components
- **React Query** - Data fetching and caching
- **React Router v6** - Client-side routing

### Backend
- **Python 3.14** - Programming language
- **FastAPI** - Modern Python web framework
- **uv** - Ultra-fast Python package manager
- **Selenium** - Browser automation for scraping
- **Docker** - Containerization

### Infrastructure
- **Docker Compose** - Multi-container orchestration
- **Nginx** - Web server for frontend
- **Selenium Standalone Chrome** - Headless browser

## Getting Started

### Prerequisites

**Option 1: Docker (Recommended)**
- Docker 20.10+
- Docker Compose 2.0+

**Option 2: Local Development**
- Node.js 18+
- npm 9+
- Python 3.14+
- uv package manager

### Quick Start with Docker 🐳

The easiest way to run the entire application:

```bash
# Clone the repository
git clone https://github.com/evanhfw/protype-dashboard.git
cd protype-dashboard

# Start all services (frontend, backend, worker)
docker-compose -f docker-compose.dev.yml up

# Access the application
# Frontend: http://localhost:8080
# Backend API: http://localhost:3000
# API Docs: http://localhost:3000/docs
# Selenium VNC (debug): http://localhost:7900 (password: secret)
```

**Note**: No .env configuration needed! You can enter your Dicoding credentials directly in the web interface.

### Docker Commands

| Command | Description |
|---------|-------------|
| `docker-compose -f docker-compose.dev.yml up` | Start development mode (with hot-reload) |
| `docker-compose up -d` | Start production mode (detached) |
| `docker-compose up --build` | Rebuild and start containers |
| `docker-compose down` | Stop all containers |
| `docker-compose down -v` | Stop and remove volumes (reset data) |
| `docker-compose logs -f backend` | View backend logs |
| `docker-compose ps` | List running containers |

### Local Development (Without Docker)

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:8080
```

**Backend:**
```bash
cd backend

# Install uv if not installed
# curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
uv sync

# Configure environment (from root directory)
cd ..
cp .env.example .env
# Edit .env with your credentials

# Run backend
cd backend
uv run uvicorn app.main:app --reload --port 3000
# API runs on http://localhost:3000
# Docs at http://localhost:3000/docs
```

**Note:** For local backend, you need Selenium running separately or a local chromedriver.

### Available Scripts (Local Development)

**Frontend (`frontend/` directory):**
| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run build:dev` | Development build (unminified) |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |

**Backend (`backend/` directory):**
| Command | Description |
|---------|-------------|
| `uv sync` | Install dependencies |
| `uv run uvicorn app.main:app --reload` | Start dev server with hot-reload |
| `uv run uvicorn app.main:app` | Start production server |

## Credentials & Environment Variables

### Dynamic Credentials (Recommended)

**No configuration needed!** Simply enter your Dicoding credentials in the web interface when you want to scrape data.

Benefits:
- ✅ No .env file configuration required
- ✅ Multiple users can use their own credentials
- ✅ Credentials not stored anywhere
- ✅ Works immediately after starting containers

### Alternative: Environment Variables (Optional)

If you want to use hardcoded credentials (for automated/scheduled scraping), create a `.env` file **in the root directory**:

```bash
# Copy the template
cp .env.example .env
# Edit with your credentials
```

The `.env` file should contain:

```env
# ===================================
# Backend Environment Variables
# ===================================
# Dicoding Credentials (OPTIONAL - can enter in UI instead)
DICODING_EMAIL=your-email@student.devacademy.id
DICODING_PASSWORD=your-password

# Backend Services Configuration
CODINGCAMP_URL=https://codingcamp.dicoding.com

# ===================================
# Frontend Environment Variables
# (Only VITE_* prefix is exposed to browser)
# ===================================
VITE_API_URL=http://localhost:3000
```

**Important:** 
- Never commit `.env` file with real credentials to Git!
- All environment variables are in **one file** at the project root
- Frontend can only access variables with `VITE_*` prefix (secure by design)

### How Credentials Work

1. **UI Input (Preferred)**: Enter credentials in web form → Sent to API → Used for scraping → Discarded
2. **ENV Fallback**: If no credentials provided in UI, backend falls back to .env file
3. **Priority**: UI credentials always override .env credentials

## How It Works

### Using the Application

1. **Start the application**: Run `docker-compose -f docker-compose.dev.yml up`
2. **Open the web interface**: Navigate to http://localhost:8080
3. **Choose data source**:
   - **Option 1 (Recommended)**: Enter your Dicoding credentials in the "Auto Scrape" tab and click "Start Scraping"
   - **Option 2**: Upload HTML file or paste HTML content manually
4. **Wait for scraping**: If using auto-scrape, wait 2-5 minutes for data collection
5. **View dashboard**: Data appears automatically with student progress visualizations

### Technical Flow

1. **Credential Input**: User enters Dicoding email and password in the frontend form
2. **API Request**: Frontend sends credentials to backend API (`POST /api/scrape`)
3. **Background Scraping**: Backend starts Selenium automation in background:
   - Connects to Selenium standalone container
   - Logs into Dicoding with provided credentials
   - Navigates and expands all student data
   - Extracts comprehensive progress information
4. **Data Storage**: Scraped data saved as timestamped JSON in `backend/output/` (Docker volume)
5. **Status Polling**: Frontend polls scraper status every 5 seconds
6. **Data Transformation**: Backend API transforms data to frontend-friendly format
7. **Auto-refresh**: When complete, page refreshes to display new data

### Security Features

- **No credential storage**: Credentials are NOT stored anywhere (frontend or backend)
- **Session-less**: Each scrape requires re-entering credentials
- **Password clearing**: Password field cleared immediately after submission
- **API validation**: Email format validated via Pydantic
- **Multi-user support**: Each user's data saved separately with timestamps

## Contributing

We welcome contributions from the community! Here's how you can help:

### Ways to Contribute

- Report bugs and issues
- Suggest new features or improvements
- Submit pull requests
- Improve documentation
- Share feedback

### Development Workflow

1. **Fork the repository** - Click the "Fork" button on GitHub

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/protype-dashboard.git
   cd protype-dashboard
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make your changes** - Follow our code style guidelines in [AGENTS.md](./AGENTS.md)

5. **Run checks before committing**
   ```bash
   npm run lint
   npm run test
   npm run build
   ```

6. **Commit your changes**
   ```bash
   git commit -m "feat: add your feature description"
   ```

7. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

8. **Open a Pull Request** - Go to the original repository and click "New Pull Request"

### Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Reporting Issues & Feedback

### Found a Bug?

1. **Search existing issues** - Check if the bug has already been reported
2. **Create a new issue** - If not found, [open a new issue](https://github.com/YOUR_USERNAME/protype-dashboard/issues/new)
3. **Include details**:
   - Clear description of the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots (if applicable)
   - Browser and OS information

### Have a Feature Request?

1. [Open a new issue](https://github.com/YOUR_USERNAME/protype-dashboard/issues/new)
2. Use the title format: `[Feature Request] Your feature title`
3. Describe:
   - What problem does this solve?
   - How should it work?
   - Any alternatives you've considered

### General Feedback

We appreciate all feedback! You can:
- Open a [GitHub Discussion](https://github.com/YOUR_USERNAME/protype-dashboard/discussions) for questions and ideas
- Comment on existing issues to share your thoughts

## API Endpoints

The backend provides the following REST API endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/students` | GET | Get latest student data |
| `/api/scrape` | POST | Trigger new scraping job (background task) |
| `/api/scrape/status` | GET | Get scraper status and last run info |
| `/api/files` | GET | List all scraped data files |
| `/api/files/{filename}` | GET | Get data from specific file |

Interactive API documentation available at: `http://localhost:3000/docs`

## CI/CD Deployment

This project includes automated deployment to VPS using GitHub Actions. On every push to the `main` branch, the workflow will:

1. Build frontend and backend Docker images
2. Push images to Docker Hub
3. Deploy to VPS using docker-compose

### Setup GitHub Secrets

To enable automated deployment, configure the following secrets in your GitHub repository (`Settings` → `Secrets and variables` → `Actions` → `New repository secret`):

| Secret | Description | Example Value |
|--------|-------------|---------------|
| `DOCKER_USERNAME` | Docker Hub username | `yourusername` |
| `DOCKER_PASSWORD` | Docker Hub password or access token | `dckr_pat_xxxxx` |
| `HOST` | VPS IP address or hostname | `123.45.67.89` |
| `USERNAME` | VPS SSH username | `root` or `ubuntu` |
| `VPS_PASSWORD` | VPS SSH password | `your-secure-password` |
| `HOST_PORT` | Port for frontend (default: 8080) | `8080` |
| `VITE_API_URL` | Backend API URL for frontend | `http://123.45.67.89:3000` |
| `DEPLOY_PATH` | Deployment directory on VPS | `/home/user/cohort-dashboard` |

**Notes:**
- Get Docker Hub access token from: https://hub.docker.com/settings/security
- Dicoding credentials should be entered by users in the web interface (not stored in secrets)
- Make sure `DEPLOY_PATH` directory is writable by SSH user

### VPS Requirements

Your VPS must have:
- Docker 20.10+ installed
- Docker Compose 2.0+ installed
- SSH access enabled
- Ports 8080, 3000, 4444, 7900 available (or configure different ports)

### Manual Deployment

To deploy manually to your VPS:

```bash
# 1. SSH into your VPS
ssh user@your-vps-ip

# 2. Create deployment directory
mkdir -p /path/to/app
cd /path/to/app

# 3. Clone the repository
git clone https://github.com/yourusername/protype-dashboard.git .

# 4. Create .env file with production values
cat > .env << EOF
DOCKER_USERNAME=yourusername
HOST_PORT=8080
VITE_API_URL=http://your-vps-ip:3000
EOF

# 5. Pull images and start services
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# 6. Check status
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f
```

### Production URLs

After deployment, access your application at:
- **Frontend**: `http://YOUR_VPS_IP:8080`
- **Backend API**: `http://YOUR_VPS_IP:3000`
- **API Docs**: `http://YOUR_VPS_IP:3000/docs`
- **Selenium VNC** (debugging): `http://YOUR_VPS_IP:7900`

## Project Structure

```
protype-dashboard/
├── frontend/                # React frontend application
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/         # shadcn/ui primitives
│   │   │   └── dashboard/  # Dashboard components
│   │   ├── data/           # Data models and utilities
│   │   ├── lib/            # Utilities (cn helper)
│   │   ├── pages/          # Route page components
│   │   ├── contexts/       # React contexts
│   │   ├── App.tsx         # Root component
│   │   └── main.tsx        # Entry point
│   ├── public/             # Static assets
│   ├── Dockerfile          # Frontend container config
│   └── package.json        # Frontend dependencies
│
├── backend/                # Python FastAPI backend
│   ├── app/
│   │   ├── main.py         # FastAPI application
│   │   ├── api/
│   │   │   └── routes.py   # API endpoints
│   │   ├── services/
│   │   │   └── scraper.py  # Dicoding scraper service
│   │   └── utils/
│   │       ├── parser.py   # Data transformer
│   │       └── file_handler.py  # File operations
│   ├── output/             # Scraped JSON data storage
│   ├── Dockerfile          # Backend container config
│   └── pyproject.toml      # Python dependencies (uv)
│
├── docker-compose.yml      # Production Docker config
├── docker-compose.dev.yml  # Development Docker config
├── .env                    # Environment variables (git-ignored)
├── .env.example            # Environment variables template
└── README.md               # This file
```

## Code of Conduct

Please be respectful and constructive in all interactions. We are committed to providing a welcoming and inclusive environment for everyone.

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgements

- [shadcn/ui](https://ui.shadcn.com/) for the beautiful UI components
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework
- Dicoding scraper logic in `backend/app/services/scraper.py` is adapted from [LightDani/diCodex](https://github.com/LightDani/diCodex) (original author: [@LightDani](https://github.com/LightDani))
- See [NOTICE](NOTICE) for attribution details
- All our contributors and supporters

---

**Questions?** Feel free to [open an issue](https://github.com/YOUR_USERNAME/protype-dashboard/issues) or start a [discussion](https://github.com/YOUR_USERNAME/protype-dashboard/discussions).
