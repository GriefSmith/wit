ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
BACKEND_DIR := $(ROOT)/backend
FRONTEND_DIR := $(ROOT)/frontend
VENV := $(ROOT)/.venv
UVICORN := $(VENV)/bin/uvicorn
PYTEST := $(VENV)/bin/pytest

.PHONY: dev backend frontend install install-backend install-frontend test

# Start backend (http://127.0.0.1:8000) and frontend (http://localhost:5173).
dev:
	@test -x $(UVICORN) || (echo "Missing $(UVICORN). Run: make install-backend" && exit 1)
	@test -d $(FRONTEND_DIR)/node_modules || (echo "Missing frontend deps. Run: make install-frontend" && exit 1)
	@echo "Starting backend → http://127.0.0.1:8000"
	@echo "Starting frontend → http://localhost:5173"
	@trap 'kill 0' INT TERM; \
	$(UVICORN) app.main:app --reload --app-dir $(BACKEND_DIR) & \
	npm --prefix $(FRONTEND_DIR) run dev & \
	wait

backend:
	@test -x $(UVICORN) || (echo "Missing $(UVICORN). Run: make install-backend" && exit 1)
	$(UVICORN) app.main:app --reload --app-dir $(BACKEND_DIR)

frontend:
	@test -d $(FRONTEND_DIR)/node_modules || (echo "Missing frontend deps. Run: make install-frontend" && exit 1)
	npm --prefix $(FRONTEND_DIR) run dev

install: install-backend install-frontend

install-backend:
	uv venv $(VENV)
	uv pip install -e $(BACKEND_DIR)

install-frontend:
	npm install --prefix $(FRONTEND_DIR)

test:
	@test -x $(PYTEST) || (echo "Missing $(PYTEST). Run: make install-backend" && exit 1)
	$(PYTEST) $(BACKEND_DIR)/tests/ -v
