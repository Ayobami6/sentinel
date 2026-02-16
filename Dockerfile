# Use Python 3.12 slim image
FROM python:3.12-slim

# Install uv for dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Set working directory
WORKDIR /app

# Copy dependency definition
COPY pyproject.toml .

# Install dependencies
RUN uv sync --frozen --no-install-project || uv sync --no-install-project

# Copy application code
COPY . .

# Expose port 8000
EXPOSE 8000

# Command to run the application
CMD ["uv", "run", "python", "main.py"]
