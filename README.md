# Yovi_es5a - Game Y at UniOvi

[![Release — Test, Build, Publish, Deploy](https://github.com/arquisoft/yovi_es5a/actions/workflows/release-deploy.yml/badge.svg)](https://github.com/arquisoft/yovi_es5a/actions/workflows/release-deploy.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Arquisoft_yovi_es5a&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Arquisoft_yovi_es5a)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=Arquisoft_yovi_es5a&metric=coverage)](https://sonarcloud.io/summary/new_code?id=Arquisoft_yovi_es5a)

This project is a template with some basic functionality for the ASW labs.

## Project Structure

The project is divided into three main components, each in its own directory:

- `webapp/`: A frontend application built with React, Vite, and TypeScript.
- `users/`: A backend service for managing users, built with Node.js and Express.
  - `database/`: Database schema and initialization files.
  - `scripts/`: Scripts for database setup and maintenance.
- `gamey/`: A Rust game engine and bot service.
- `docs/`: Architecture documentation sources following Arc42 template

Each component has its own `package.json` file with the necessary scripts to run and test the application.

## Basic Features

- **User Registration**: The web application provides a simple form to register new users.
- **User Service**: The user service receives the registration request, processes it, and stores users in a MySQL database.
- **GameY**: A basic Game engine which only chooses a random piece.

## Database Setup

The project now includes a MySQL service that is automatically created when you run `docker-compose up --build` for the first time. The database and users table are initialized automatically through the `users/database/init.sql` script.

### Docker Compose (Recommended for Development)

When you run:

```bash
docker-compose up --build
```

The following happens automatically:
1. MySQL service starts and creates the database `yovi_db` and the `users` table (first run only)
2. The database persists in `mysql_data` volume (survives container restarts)
3. Users service connects to MySQL using `DB_HOST=mysql` (the service name in docker-compose.yml)

Subsequent runs of `docker-compose up` will use the existing database (no re-initialization).

### Environment Variables for Docker

Copy `.env.example` to `.env` for custom configuration:

```bash
cp users/.env.example users/.env
```

Default values in `docker-compose.yml`:
- `DB_HOST`: `mysql` (Docker service name)
- `DB_USER`: `root`
- `DB_PASSWORD`: `rootpassword`
- `DB_NAME`: `yovi_db`

For production on Azure VM, update `.env` with:
- `DB_HOST`: Your Azure VM IP address
- `DB_PASSWORD`: Your actual MySQL password

### Database Schema

The database is created automatically with:

```sql
CREATE DATABASE yovi_db;
USE yovi_db;
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### For Azure VM Deployment

If deploying to Azure VM without Docker:

1. Install MySQL on the VM
2. Copy `users/scripts/init-db.sh` and `users/database/init.sql` to the VM
3. Set environment variables and execute:

```bash
export DB_HOST=localhost
export DB_USER=root
export DB_PASSWORD=your_password
chmod +x users/scripts/init-db.sh
./users/scripts/init-db.sh
```

Then update `.env` with your VM credentials before starting the service.

## Components

### Webapp

The `webapp` is a single-page application (SPA) created with [Vite](https://vitejs.dev/) and [React](https://reactjs.org/).

- `src/App.tsx`: The main component of the application.
- `src/RegisterForm.tsx`: The component that renders the user registration form.
- `package.json`: Contains scripts to run, build, and test the webapp.
- `vite.config.ts`: Configuration file for Vite.
- `Dockerfile`: Defines the Docker image for the webapp.

### Users Service

The `users` service is a simple REST API built with [Node.js](https://nodejs.org/) and [Express](https://expressjs.com/).

- `users-service.js`: The main file for the user service. It defines an endpoint `/createuser` to handle user creation and stores users in a MySQL database.
- `package.json`: Contains scripts to start the service.
- `Dockerfile`: Defines the Docker image for the user service.
- `database/init.sql`: SQL script to initialize the database and create the users table.
- `scripts/init-db.sh`: Bash script to run on Azure VM to set up the database.
- `.env.example`: Template for environment variables (credentials and database host).

### Gamey

The `gamey` component is a Rust-based game engine with bot support, built with [Rust](https://www.rust-lang.org/) and [Cargo](https://doc.rust-lang.org/cargo/).

- `src/main.rs`: Entry point for the application.
- `src/lib.rs`: Library exports for the gamey engine.
- `src/bot/`: Bot implementation and registry.
- `src/core/`: Core game logic including actions, coordinates, game state, and player management.
- `src/notation/`: Game notation support (YEN, YGN).
- `src/web/`: Web interface components.
- `Cargo.toml`: Project manifest with dependencies and metadata.
- `Dockerfile`: Defines the Docker image for the gamey service.

## Running the Project

You can run this project using Docker (recommended) or locally without Docker.

### With Docker

This is the easiest way to get the project running. You need to have [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed.

1. **Build and run the containers:**
    From the root directory of the project, run:

```bash
docker-compose up --build
```

This command will:
- Create and start a MySQL database (first run only)
- Build and start the `users` service (connected to MySQL)
- Build and start the `webapp` service
- Build and start the `gamey` and monitoring services

The database initializes automatically on the first run using `users/database/init.sql`.

2.**Access the application:**
- Web application: [http://localhost](http://localhost)
- User service API: [http://localhost:3000](http://localhost:3000)
- Gamey API: [http://localhost:4000](http://localhost:4000)

### Without Docker

To run the project locally without Docker, you will need to run each component in a separate terminal.

#### Prerequisites

* [Node.js](https://nodejs.org/) and npm installed.
* MySQL server installed and running locally.

#### 1. Running the User Service

First, set up the database. You can do this by:

1. Open MySQL client: `mysql -u root -p`
2. Copy and paste the contents of `users/database/init.sql`
3. Or, run: `mysql -u root -p < users/database/init.sql`

Then, navigate to the `users` directory:

```bash
cd users
```

Install dependencies:

```bash
npm install
```

Create a `.env` file from `.env.example` and update with your MySQL credentials:

```bash
cp .env.example .env
# Edit .env with your local MySQL connection details
```

Run the service:

```bash
npm start
```

The user service will be available at `http://localhost:3000`.

#### 2. Running the Web Application

Navigate to the `webapp` directory:

```bash
cd webapp
```

Install dependencies:

```bash
npm install
```

Run the application:

```bash
npm run dev
```

The web application will be available at `http://localhost:5173`.

#### 3. Running the GameY application

At this moment the GameY application is not needed but once it is needed you should also start it from the command line.

## Available Scripts

Each component has its own set of scripts defined in its `package.json`. Here are some of the most important ones:

### Webapp (`webapp/package.json`)

- `npm run dev`: Starts the development server for the webapp.
- `npm test`: Runs the unit tests.
- `npm run test:e2e`: Runs the end-to-end tests.
- `npm run start:all`: A convenience script to start both the `webapp` and the `users` service concurrently.

### Users (`users/package.json`)

- `npm start`: Starts the user service.
- `npm test`: Runs the tests for the service.

### Gamey (`gamey/Cargo.toml`)

- `cargo build`: Builds the gamey application.
- `cargo test`: Runs the unit tests.
- `cargo run`: Runs the gamey application.
- `cargo doc`: Generates documentation for the GameY engine application
